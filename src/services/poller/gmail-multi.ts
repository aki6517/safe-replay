/**
 * マルチユーザー対応Gmailポーリングサービス
 * DBに登録された全アクティブユーザーのGmailを監視
 */
import { getSupabase, isSupabaseAvailable } from '../../db/client';
import { redis, isRedisAvailable } from '../../db/redis';
import { 
  createGmailClientForUser, 
  getUnreadMessagesForUser,
  extractMessageBody,
  extractMessageHeaders,
  type GmailUserCredentials
} from '../gmail';
import { triageMessage } from '../../ai/triage';
import { generateDraft } from '../../ai/draft';
import { sendLineNotification } from '../notifier';
import { isBlocked } from '../blocklist';

/**
 * DBからアクティブユーザー一覧を取得
 */
async function getActiveUsers(): Promise<GmailUserCredentials[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    console.error('[getActiveUsers] Supabaseが利用できません');
    return [];
  }

  try {
    const { data, error } = await (supabase.from('users') as any)
      .select('id, line_user_id, gmail_refresh_token, gmail_email')
      .eq('status', 'active')
      .not('gmail_refresh_token', 'is', null);

    if (error) {
      console.error('[getActiveUsers] クエリエラー:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[getActiveUsers] アクティブユーザーが見つかりません');
      return [];
    }

    return data.map((user: any) => ({
      userId: user.id,
      lineUserId: user.line_user_id,
      gmailRefreshToken: user.gmail_refresh_token,
      gmailEmail: user.gmail_email
    }));
  } catch (error: any) {
    console.error('[getActiveUsers] エラー:', error.message);
    return [];
  }
}

/**
 * 処理済みメッセージIDをRedisから取得
 */
async function getProcessedMessageIds(userId: string): Promise<Set<string>> {
  if (!isRedisAvailable() || !redis) {
    return new Set();
  }

  try {
    const key = `gmail:processed:${userId}`;
    const ids = await redis.smembers(key);
    return new Set(ids as string[]);
  } catch (error) {
    console.error('Failed to get processed message IDs from Redis:', error);
    return new Set();
  }
}

/**
 * メッセージIDを処理済みとしてRedisに保存
 */
async function markMessageAsProcessed(userId: string, messageId: string): Promise<void> {
  if (!isRedisAvailable() || !redis) {
    return;
  }

  try {
    const key = `gmail:processed:${userId}`;
    await redis.sadd(key, messageId);
    // 30日間の有効期限を設定
    await redis.expire(key, 30 * 24 * 60 * 60);
  } catch (error) {
    console.error('Failed to mark message as processed in Redis:', error);
  }
}

/**
 * 単一ユーザーのGmailをポーリング
 */
async function pollGmailForUser(
  credentials: GmailUserCredentials,
  maxResults: number = 50
): Promise<{
  messagesNew: number;
  messagesSkipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let messagesNew = 0;
  let messagesSkipped = 0;

  // ユーザー固有のGmailクライアントを作成
  const gmailClient = createGmailClientForUser(credentials);
  if (!gmailClient) {
    errors.push(`Failed to create Gmail client for user ${credentials.userId}`);
    return { messagesNew, messagesSkipped, errors };
  }

  try {
    // 未読メッセージを取得
    const messages = await getUnreadMessagesForUser(gmailClient, maxResults, 3);
    
    // 処理済みメッセージIDを取得
    const processedIds = await getProcessedMessageIds(credentials.userId);

    const supabase = getSupabase();

    for (const message of messages) {
      try {
        // 既に処理済みのメッセージはスキップ
        if (processedIds.has(message.id)) {
          messagesSkipped++;
          continue;
        }

        // メッセージ本文とヘッダーを抽出
        const body = extractMessageBody(message);
        const headers = extractMessageHeaders(message);

        // ブロックチェック
        if (headers.from) {
          const blocked = await isBlocked(credentials.userId, headers.from);
          if (blocked) {
            messagesSkipped++;
            await markMessageAsProcessed(credentials.userId, message.id);
            continue;
          }
        }

        console.log('[マルチユーザーPoller] 新規メッセージを処理', {
          userId: credentials.userId,
          gmailEmail: credentials.gmailEmail,
          subject: headers.subject || '(件名なし)'
        });

        // データベースに保存
        if (supabase) {
          const insertData = {
            user_id: credentials.userId,
            source_type: 'gmail' as const,
            source_message_id: message.id,
            thread_id: message.threadId || null,
            sender_identifier: headers.from || '',
            sender_name: headers.from || null,
            subject: headers.subject || null,
            body_plain: body || null,
            extracted_content: body || null,
            received_at: message.internalDate 
              ? new Date(parseInt(message.internalDate)).toISOString()
              : new Date().toISOString(),
            status: 'pending' as const,
            metadata: {
              labelIds: message.labelIds || [],
              snippet: message.snippet
            } as Record<string, unknown>
          };

          const { data: insertedData, error: dbError } = await (supabase.from('messages') as any)
            .insert(insertData)
            .select()
            .single();

          if (dbError) {
            if (dbError.code !== '23505') { // 重複エラー以外
              errors.push(`DB error for message ${message.id}: ${dbError.message}`);
            } else {
              messagesSkipped++;
            }
            continue;
          }

          messagesNew++;
          const messageId = insertedData?.id;

          if (messageId) {
            // AIトリアージを実行
            try {
              const triageResult = await triageMessage(
                headers.subject || '',
                body
              );

              // トリアージ結果をDBに更新
              await (supabase.from('messages') as any).update({
                triage_type: triageResult.type,
                triage_reason: triageResult.reason,
                priority_score: triageResult.priority_score,
                ai_analysis: {
                  confidence: triageResult.confidence,
                  details: triageResult.details
                } as Record<string, unknown>
              }).eq('id', messageId);

              // ドラフト生成（Type A, B）
              let draft: string | undefined;
              if (triageResult.type === 'A' || triageResult.type === 'B') {
                try {
                  draft = await generateDraft(
                    headers.subject || '',
                    body,
                    triageResult.type
                  );

                  if (draft) {
                    await (supabase.from('messages') as any).update({
                      draft_reply: draft
                    }).eq('id', messageId);
                  }
                } catch (draftError: any) {
                  console.warn(`Failed to generate draft: ${draftError.message}`);
                }
              }

              // LINE通知を送信
              try {
                let softenedBody = '';
                try {
                  const { softenMessage } = await import('../../ai/soften');
                  const senderName = headers.from 
                    ? headers.from.replace(/<[^>]+>/g, '').trim()
                    : undefined;
                  
                  softenedBody = await softenMessage(
                    headers.subject || '',
                    body,
                    senderName,
                    triageResult.type,
                    draft
                  );

                  if (!softenedBody || softenedBody === body) {
                    const displaySender = senderName || headers.from || '送信者';
                    softenedBody = `${displaySender}さんからメッセージが届いたよ。内容を確認してね。`;
                  }
                } catch (softenError: any) {
                  const senderName = headers.from 
                    ? headers.from.replace(/<[^>]+>/g, '').trim()
                    : '送信者';
                  softenedBody = `${senderName}さんからメッセージが届いたよ。内容を確認してね。`;
                }

                await sendLineNotification(
                  credentials.lineUserId,
                  messageId,
                  triageResult.type,
                  {
                    subject: headers.subject,
                    body: softenedBody.substring(0, 400),
                    sender: headers.from || 'Unknown',
                    source: 'Gmail'
                  },
                  draft
                );
              } catch (notifyError: any) {
                errors.push(`Notification error: ${notifyError.message}`);
              }
            } catch (triageError: any) {
              errors.push(`Triage error: ${triageError.message}`);
            }

            // 処理済みとしてマーク
            await markMessageAsProcessed(credentials.userId, message.id);
          }
        }
      } catch (msgError: any) {
        errors.push(`Message processing error: ${msgError.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`Gmail polling error for user ${credentials.userId}: ${error.message}`);
  }

  return { messagesNew, messagesSkipped, errors };
}

/**
 * マルチユーザー対応Gmailポーリング（メイン関数）
 */
export async function pollGmailMultiUser(
  maxResults: number = 50
): Promise<{
  summary: {
    users_processed: number;
    users_with_errors: number;
    total_messages_new: number;
    total_messages_skipped: number;
    errors: string[];
  };
  userDetails: Array<{
    userId: string;
    gmailEmail?: string;
    messagesNew: number;
    messagesSkipped: number;
    errors: string[];
  }>;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  const allErrors: string[] = [];
  const userDetails: Array<{
    userId: string;
    gmailEmail?: string;
    messagesNew: number;
    messagesSkipped: number;
    errors: string[];
  }> = [];

  // アクティブユーザーを取得
  const activeUsers = await getActiveUsers();
  
  if (activeUsers.length === 0) {
    console.log('[pollGmailMultiUser] 処理対象のユーザーがいません');
    return {
      summary: {
        users_processed: 0,
        users_with_errors: 0,
        total_messages_new: 0,
        total_messages_skipped: 0,
        errors: ['No active users found']
      },
      userDetails: [],
      processingTimeMs: Date.now() - startTime
    };
  }

  console.log(`[pollGmailMultiUser] ${activeUsers.length}人のユーザーを処理開始`);

  let totalNew = 0;
  let totalSkipped = 0;
  let usersWithErrors = 0;

  // 各ユーザーを順番に処理
  for (const user of activeUsers) {
    console.log(`[pollGmailMultiUser] ユーザー処理中: ${user.gmailEmail || user.userId}`);
    
    const result = await pollGmailForUser(user, maxResults);
    
    userDetails.push({
      userId: user.userId,
      gmailEmail: user.gmailEmail,
      messagesNew: result.messagesNew,
      messagesSkipped: result.messagesSkipped,
      errors: result.errors
    });

    totalNew += result.messagesNew;
    totalSkipped += result.messagesSkipped;
    
    if (result.errors.length > 0) {
      usersWithErrors++;
      allErrors.push(...result.errors);
    }

    // レート制限を避けるため少し待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[pollGmailMultiUser] 完了: ${activeUsers.length}ユーザー処理, ${totalNew}件の新規メッセージ`);

  return {
    summary: {
      users_processed: activeUsers.length,
      users_with_errors: usersWithErrors,
      total_messages_new: totalNew,
      total_messages_skipped: totalSkipped,
      errors: allErrors
    },
    userDetails,
    processingTimeMs: Date.now() - startTime
  };
}

