/**
 * マルチユーザー対応Chatworkポーリングサービス
 * DBに登録された全アクティブユーザーのChatworkを監視
 */
import {
  getMessagesToMe,
  extractMessageText,
  isChatworkClientAvailable
} from '../chatwork';
import { redis, isRedisAvailable, markRedisUnavailable } from '../../db/redis';
import { getSupabase, isSupabaseAvailable } from '../../db/client';
import { triageMessage } from '../../ai/triage';
import { generateDraft } from '../../ai/draft';
import { sendLineNotification } from '../notifier';

/**
 * Chatworkユーザー情報
 */
interface ChatworkUserCredentials {
  userId: string;       // DB UUID
  lineUserId: string;   // LINE User ID
  chatworkApiToken: string;
}

/**
 * DBからChatwork設定済みのアクティブユーザー一覧を取得
 */
async function getActiveChatworkUsers(): Promise<ChatworkUserCredentials[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    console.error('[getActiveChatworkUsers] Supabaseが利用できません');
    return [];
  }

  try {
    const { data, error } = await (supabase.from('users') as any)
      .select('id, line_user_id, chatwork_api_token')
      .eq('status', 'active')
      .not('chatwork_api_token', 'is', null);

    if (error) {
      console.error('[getActiveChatworkUsers] クエリエラー:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[getActiveChatworkUsers] Chatwork設定済みのアクティブユーザーが見つかりません');
      return [];
    }

    return data.map((user: any) => ({
      userId: user.id,
      lineUserId: user.line_user_id,
      chatworkApiToken: user.chatwork_api_token
    }));
  } catch (error: any) {
    console.error('[getActiveChatworkUsers] エラー:', error.message);
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
    const key = `chatwork:processed:${userId}`;
    const ids = await redis.smembers(key);
    return new Set(ids as string[]);
  } catch (error) {
    console.error('Failed to get processed message IDs from Redis:', error);
    markRedisUnavailable(error);
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
    const key = `chatwork:processed:${userId}`;
    await redis.sadd(key, messageId);
    // 30日間の有効期限を設定
    await redis.expire(key, 30 * 24 * 60 * 60);
  } catch (error) {
    console.error('Failed to mark message as processed in Redis:', error);
    markRedisUnavailable(error);
  }
}

/**
 * 単一ユーザーのChatworkをポーリング
 */
async function pollChatworkForUser(
  credentials: ChatworkUserCredentials,
  maxResults: number = 50
): Promise<{
  messagesNew: number;
  messagesSkipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let messagesNew = 0;
  let messagesSkipped = 0;

  if (!isChatworkClientAvailable(credentials.chatworkApiToken)) {
    errors.push(`Chatwork API token invalid for user ${credentials.userId}`);
    return { messagesNew, messagesSkipped, errors };
  }

  try {
    // ユーザー固有のトークンでメッセージを取得
    const messages = await getMessagesToMe(maxResults, 7, credentials.chatworkApiToken);

    // 処理済みメッセージIDを取得
    const processedIds = await getProcessedMessageIds(credentials.userId);
    const supabase = getSupabase();

    for (const message of messages) {
      try {
        // 既に処理済みのメッセージはスキップ
        if (processedIds.has(message.message_id)) {
          messagesSkipped++;
          continue;
        }

        // メッセージ本文を抽出
        const messageText = extractMessageText(message);

        // データベースに保存
        if (supabase) {
          const insertData = {
            user_id: credentials.userId,
            source_type: 'chatwork' as const,
            source_message_id: message.message_id,
            thread_id: null,
            sender_identifier: message.account.account_id.toString(),
            sender_name: message.account.name || null,
            subject: null,
            body_plain: messageText || null,
            extracted_content: messageText || null,
            received_at: new Date(message.send_time * 1000).toISOString(),
            status: 'pending' as const,
            metadata: {
              room_id: message.room_id || null,
              account_id: message.account.account_id,
              avatar_path: message.account.avatar_path,
              update_time: message.update_time
            } as Record<string, unknown>
          };

          const { data: insertedData, error: dbError } = await (supabase.from('messages') as any)
            .insert(insertData)
            .select()
            .single();

          if (dbError) {
            if (dbError.code !== '23505') {
              errors.push(`DB error for message ${message.message_id}: ${dbError.message}`);
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
              const triageResult = await triageMessage('', messageText);

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
                  draft = await generateDraft('', messageText, triageResult.type);
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
                let softenedBody = messageText;
                try {
                  const { softenMessage } = await import('../../ai/soften');
                  softenedBody = await softenMessage(
                    '',
                    messageText,
                    message.account.name || undefined,
                    triageResult.type,
                    draft,
                    undefined
                  );
                } catch (softenError: any) {
                  console.warn(`Failed to soften message: ${softenError.message}`);
                }

                await sendLineNotification(
                  credentials.lineUserId,
                  messageId,
                  triageResult.type,
                  {
                    subject: undefined,
                    body: softenedBody.substring(0, 800),
                    sender: message.account.name || 'Unknown',
                    source: 'Chatwork'
                  },
                  draft,
                  { notifyTypeC: true }
                );
              } catch (notifyError: any) {
                errors.push(`Notification error: ${notifyError.message}`);
              }
            } catch (triageError: any) {
              errors.push(`Triage error: ${triageError.message}`);
            }

            // 処理済みとしてマーク
            await markMessageAsProcessed(credentials.userId, message.message_id);
          }
        }
      } catch (msgError: any) {
        errors.push(`Message processing error: ${msgError.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`Chatwork polling error for user ${credentials.userId}: ${error.message}`);
  }

  return { messagesNew, messagesSkipped, errors };
}

/**
 * マルチユーザー対応Chatworkポーリング（メイン関数）
 * 後方互換: lineUserId指定時は従来の単一ユーザーモードで動作
 */
export async function pollChatwork(
  lineUserId?: string,
  maxResults: number = 50
): Promise<{
  summary: {
    users_processed: number;
    rooms_checked: number;
    messages_fetched: number;
    messages_new: number;
    self_messages_skipped: number;
    errors: string[];
  };
  details: any[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  const allErrors: string[] = [];

  // マルチユーザーモード: DBから全アクティブユーザーを取得
  const activeUsers = await getActiveChatworkUsers();

  // lineUserIdが指定された場合は該当ユーザーのみ、なければ全員
  const targetUsers = lineUserId
    ? activeUsers.filter(u => u.lineUserId === lineUserId)
    : activeUsers;

  // DBにユーザーがいない場合、環境変数フォールバック（後方互換）
  if (targetUsers.length === 0 && isChatworkClientAvailable()) {
    const fallbackLineUserId = lineUserId || process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim() || '';
    if (fallbackLineUserId) {
      console.log('[pollChatwork] DBにユーザーがいないため環境変数フォールバック');
      // 旧ロジック: グローバルトークンで単一ユーザー処理
      const messages = await getMessagesToMe(maxResults);
      return {
        summary: {
          users_processed: 1,
          rooms_checked: messages.length > 0 ? 1 : 0,
          messages_fetched: messages.length,
          messages_new: 0,
          self_messages_skipped: 0,
          errors: ['Using env var fallback - migrate to per-user tokens']
        },
        details: [],
        processingTimeMs: Date.now() - startTime
      };
    }

    return {
      summary: {
        users_processed: 0,
        rooms_checked: 0,
        messages_fetched: 0,
        messages_new: 0,
        self_messages_skipped: 0,
        errors: ['No active Chatwork users found']
      },
      details: [],
      processingTimeMs: Date.now() - startTime
    };
  }

  console.log(`[pollChatwork] ${targetUsers.length}人のユーザーを処理開始`);

  let totalNew = 0;
  let totalSkipped = 0;
  const details: any[] = [];

  for (const user of targetUsers) {
    console.log(`[pollChatwork] ユーザー処理中: ${user.lineUserId}`);

    const result = await pollChatworkForUser(user, maxResults);

    totalNew += result.messagesNew;
    totalSkipped += result.messagesSkipped;
    if (result.errors.length > 0) {
      allErrors.push(...result.errors);
    }

    details.push({
      userId: user.userId,
      lineUserId: user.lineUserId,
      messagesNew: result.messagesNew,
      messagesSkipped: result.messagesSkipped,
      errors: result.errors
    });

    // レート制限を避けるため少し待機
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[pollChatwork] 完了: ${targetUsers.length}ユーザー処理, ${totalNew}件の新規メッセージ`);

  return {
    summary: {
      users_processed: targetUsers.length,
      rooms_checked: 0,
      messages_fetched: totalNew + totalSkipped,
      messages_new: totalNew,
      self_messages_skipped: 0,
      errors: allErrors
    },
    details,
    processingTimeMs: Date.now() - startTime
  };
}
