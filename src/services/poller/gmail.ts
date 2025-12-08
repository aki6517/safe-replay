/**
 * Gmailポーリングサービス
 */
import {
  getUnreadMessages,
  extractMessageBody,
  extractMessageHeaders,
  getThreadHistory,
  isGmailClientAvailable,
  type GmailMessage
} from '../gmail';
import { gmail_v1 } from 'googleapis';
import { redis, isRedisAvailable } from '../../db/redis';
import { getSupabase } from '../../db/client';
import { triageMessage } from '../../ai/triage';
import { generateDraft } from '../../ai/draft';
import { sendLineNotification } from '../notifier';
import { isBlocked } from '../blocklist';

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
 * LINE User IDからusersテーブルのUUIDを取得（存在しない場合は作成）
 */
async function getOrCreateUser(lineUserId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    // 既存ユーザーを検索
    const searchResult: any = await supabase
      .from('users')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    if (searchResult.data && !searchResult.error) {
      return searchResult.data.id;
    }

    // ユーザーが存在しない場合は作成
    const insertResult = await (supabase.from('users') as any).insert({
      line_user_id: lineUserId,
      is_active: true
    }).select('id').single();

    if (insertResult.error || !insertResult.data) {
      console.error('Failed to create user:', insertResult.error);
      return null;
    }

    return insertResult.data.id;
  } catch (error: any) {
    console.error('Failed to get or create user:', error);
    return null;
  }
}

/**
 * Gmailポーリング処理
 */
export async function pollGmail(
  lineUserId?: string,
  maxResults: number = 50
): Promise<{
  summary: {
    users_processed: number;
    messages_fetched: number;
    messages_new: number;
    messages_skipped: number;
    attachments_parsed: number;
    errors: string[];
  };
  details: any[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  const details: any[] = [];

  // Gmail APIクライアントの確認
  if (!isGmailClientAvailable()) {
    return {
      summary: {
        users_processed: 0,
        messages_fetched: 0,
        messages_new: 0,
        messages_skipped: 0,
        attachments_parsed: 0,
        errors: ['Gmail API credentials not configured']
      },
      details: [],
      processingTimeMs: Date.now() - startTime
    };
  }

  try {
    // LINE User IDからusersテーブルのUUIDを取得
    // lineUserIdが渡されていない場合は、環境変数から取得を試みる
    const effectiveLineUserId = lineUserId || process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim() || '';
    let userId: string | null = null;
    if (effectiveLineUserId) {
      userId = await getOrCreateUser(effectiveLineUserId);
      if (!userId) {
        return {
          summary: {
            users_processed: 0,
            messages_fetched: 0,
            messages_new: 0,
            messages_skipped: 0,
            attachments_parsed: 0,
            errors: ['Failed to get or create user']
          },
          details: [],
          processingTimeMs: Date.now() - startTime
        };
      }
    }

    // 過去3日分のメールを取得（迷惑メール・ゴミ箱を除外）
    const messages = await getUnreadMessages(maxResults, 3);
    let messagesNew = 0;
    let messagesSkipped = 0;
    let attachmentsParsed = 0;

    // 処理済みメッセージIDを取得（userIdが指定されている場合）
    const processedIds = userId ? await getProcessedMessageIds(userId) : new Set<string>();

    for (const message of messages) {
      try {
        // 既に処理済みのメッセージはスキップ
        if (processedIds.has(message.id)) {
          messagesSkipped++;
          console.log('[処理済みメッセージをスキップ]', {
            messageId: message.id,
            subject: extractMessageHeaders(message).subject || '(件名なし)'
          });
          continue;
        }

        // メッセージ本文とヘッダーを抽出
        const body = extractMessageBody(message);
        const headers = extractMessageHeaders(message);

        // ブロックチェック
        if (userId && headers.from) {
          const blocked = await isBlocked(userId, headers.from);
          if (blocked) {
            messagesSkipped++;
            console.log('[ブロック済みアドレスをスキップ]', {
              messageId: message.id,
              from: headers.from
            });
            // 処理済みとしてマーク（再度チェックしないように）
            await markMessageAsProcessed(userId, message.id);
            continue;
          }
        }
        
        console.log('[新規メッセージを処理開始]', {
          messageId: message.id,
          subject: headers.subject || '(件名なし)',
          from: headers.from || 'Unknown'
        });

        // メッセージ詳細を記録
        const messageDetail = {
          id: message.id,
          threadId: message.threadId,
          subject: headers.subject || '',
          from: headers.from || '',
          to: headers.to || '',
          snippet: message.snippet,
          body: body.substring(0, 200) // 最初の200文字のみ
        };
        details.push(messageDetail);

        // データベースに保存（userIdが指定されている場合）
        if (userId && getSupabase()) {
          try {
            const supabase = getSupabase();
            const insertData = {
              user_id: userId,
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
            // 型アサーションを使用してSupabaseの型エラーを回避
            const { data: insertedData, error: dbError } = await (supabase.from('messages') as any).insert(insertData).select().single();

            if (dbError) {
              // 重複エラーは無視（既に処理済み）
              if (dbError.code !== '23505') {
                errors.push(`Database error for message ${message.id}: ${dbError.message}`);
                console.error('[DB保存エラー]', {
                  messageId: message.id,
                  subject: headers.subject || '(件名なし)',
                  error: dbError.message,
                  code: dbError.code
                });
              } else {
                messagesSkipped++;
                console.log('[重複メッセージをスキップ]', {
                  messageId: message.id,
                  subject: headers.subject || '(件名なし)',
                  reason: '既にDBに保存済み'
                });
                continue;
              }
            } else {
              messagesNew++;
              const messageId = insertedData?.id;

              if (messageId) {
                // スレッド履歴を取得（コンテキスト用）
                let threadContext = '';
                if (message.threadId) {
                  try {
                    const threadMessages = await getThreadHistory(message.threadId);
                    // 現在のメッセージ以外の過去5件を取得
                    const previousMessages = threadMessages
                      .filter((m: GmailMessage) => m.id !== message.id)
                      .slice(-5);
                    
                    threadContext = previousMessages
                      .map((m: GmailMessage) => {
                        const h = extractMessageHeaders(m);
                        const b = extractMessageBody(m);
                        return `【${h.from || 'Unknown'}】${b.substring(0, 200)}`;
                      })
                      .join('\n\n');
                  } catch (threadError: any) {
                    console.warn(`Failed to get thread history for ${message.threadId}:`, threadError.message);
                  }
                }

                // AIトリアージを実行
                try {
                  const triageResult = await triageMessage(
                    headers.subject || '',
                    body,
                    threadContext || undefined
                  );

                  // トリアージ結果をログに出力（デバッグ用）
                  console.log('[トリアージ結果]', {
                    messageId: message.id,
                    subject: headers.subject || '(件名なし)',
                    type: triageResult.type,
                    confidence: triageResult.confidence,
                    priority_score: triageResult.priority_score,
                    reason: triageResult.reason?.substring(0, 100) // 最初の100文字のみ
                  });

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

                  // LINE User IDを取得（effectiveLineUserIdを使用）
                  const lineUserIdForNotification = effectiveLineUserId;

                  // 全メッセージ（Type A, B）にドラフト生成（Type Cは通知しないので不要）
                  let draft: string | undefined;
                  if (triageResult.type === 'A' || triageResult.type === 'B') {
                    try {
                      draft = await generateDraft(
                        headers.subject || '',
                        body,
                        triageResult.type,
                        threadContext || undefined
                      );
                      console.log('[ドラフト生成完了]', {
                        messageId: message.id,
                        triageType: triageResult.type,
                        draftLength: draft?.length || 0
                      });
                      
                      // 返信文をDBに保存
                      if (draft) {
                        await (supabase.from('messages') as any).update({
                          draft_reply: draft
                        }).eq('id', messageId);
                      }
                    } catch (draftError: any) {
                      console.warn(`Failed to generate draft for message ${message.id}:`, draftError.message);
                    }
                  }

                  // LINE通知を送信
                  if (lineUserIdForNotification) {
                    try {
                      // ADHD向けにメッセージを柔らかく変換（LINEBOTがユーザーに語りかける形式）
                      let softenedBody = '';
                      try {
                        const { softenMessage } = await import('../../ai/soften');
                        // 送信者名を抽出（"名前 <email>" または "名前" の形式から名前を抽出）
                        const senderName = headers.from 
                          ? headers.from.replace(/<[^>]+>/g, '').trim() // メールアドレス部分を削除
                          : undefined;
                        
                        softenedBody = await softenMessage(
                          headers.subject || '',
                          body,
                          senderName,
                          triageResult.type,
                          draft, // 返信案も含める
                          threadContext || undefined
                        );
                        
                        // softenedBodyが空または元のメッセージと同じ場合は、簡易フォールバック
                        if (!softenedBody || softenedBody === body) {
                          const displaySender = senderName || headers.from || '送信者';
                          softenedBody = `${displaySender}さんからメッセージが届いたよ。内容を確認してね。`;
                        }
                        
                        console.log('[メッセージ変換完了]', {
                          messageId: message.id,
                          originalLength: body.length,
                          softenedLength: softenedBody.length,
                          triageType: triageResult.type
                        });
                      } catch (softenError: any) {
                        console.warn(`Failed to soften message ${message.id}:`, softenError.message);
                        // エラー時は簡易フォールバック
                        const senderName = headers.from 
                          ? headers.from.replace(/<[^>]+>/g, '').trim()
                          : '送信者';
                        softenedBody = `${senderName}さんからメッセージが届いたよ。内容を確認してね。`;
                      }

                      await sendLineNotification(
                        lineUserIdForNotification,
                        messageId,
                        triageResult.type,
                        {
                          subject: headers.subject,
                          body: softenedBody.substring(0, 400), // 簡潔に
                          sender: headers.from || 'Unknown',
                          source: 'Gmail'
                        },
                        draft
                      );
                    } catch (notifyError: any) {
                      errors.push(`Failed to send notification for message ${message.id}: ${notifyError.message}`);
                    }
                  }
                } catch (triageError: any) {
                  errors.push(`Failed to triage message ${message.id}: ${triageError.message}`);
                }

                // 処理済みとしてマーク
                await markMessageAsProcessed(userId, message.id);
              }
            }
          } catch (dbError: any) {
            errors.push(`Database error for message ${message.id}: ${dbError.message}`);
          }
        } else {
          // userIdが指定されていない場合は、メッセージを取得しただけ
          messagesNew++;
        }

        // 添付ファイルの数をカウント（簡易版）
        if (message.payload?.parts) {
          const attachmentParts = message.payload.parts.filter(
            (part: gmail_v1.Schema$MessagePart) => part.filename && part.filename.length > 0
          );
          attachmentsParsed += attachmentParts.length;
        }
      } catch (error: any) {
        errors.push(`Error processing message ${message.id}: ${error.message}`);
      }
    }

    return {
      summary: {
        users_processed: userId ? 1 : 0,
        messages_fetched: messages.length,
        messages_new: messagesNew,
        messages_skipped: messagesSkipped,
        attachments_parsed: attachmentsParsed,
        errors
      },
      details,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    errors.push(`Gmail polling error: ${error.message}`);
    return {
      summary: {
        users_processed: 0,
        messages_fetched: 0,
        messages_new: 0,
        messages_skipped: 0,
        attachments_parsed: 0,
        errors
      },
      details: [],
      processingTimeMs: Date.now() - startTime
    };
  }
}

