/**
 * Chatworkポーリングサービス
 */
import {
  getMessagesToMe,
  getMyId,
  extractMessageText,
  isChatworkClientAvailable
} from '../chatwork';
import { redis, isRedisAvailable } from '../../db/redis';
import { getSupabase, isSupabaseAvailable } from '../../db/client';
import { triageMessage } from '../../ai/triage';
import { generateDraft } from '../../ai/draft';
import { sendLineNotification } from '../notifier';

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
    const insertResult: any = await (supabase.from('users') as any).insert({
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
 * Chatworkポーリング処理
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
  const errors: string[] = [];
  const details: any[] = [];

  // Chatwork APIクライアントの確認
  if (!isChatworkClientAvailable()) {
    return {
      summary: {
        users_processed: 0,
        rooms_checked: 0,
        messages_fetched: 0,
        messages_new: 0,
        self_messages_skipped: 0,
        errors: ['Chatwork API token not configured']
      },
      details: [],
      processingTimeMs: Date.now() - startTime
    };
  }

  try {
    // LINE User IDからusersテーブルのUUIDを取得
    // lineUserIdが渡されていない場合は、環境変数から取得を試みる
    let effectiveLineUserId = lineUserId || process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim() || '';
    let userId: string | null = null;
    if (effectiveLineUserId) {
      userId = await getOrCreateUser(effectiveLineUserId);
      if (!userId) {
        return {
          summary: {
            users_processed: 0,
            rooms_checked: 0,
            messages_fetched: 0,
            messages_new: 0,
            self_messages_skipped: 0,
            errors: ['Failed to get or create user']
          },
          details: [],
          processingTimeMs: Date.now() - startTime
        };
      }
    }

    // 自分のIDを取得（無限ループ防止用）
    const myId = await getMyId();

    // 自分宛メッセージを取得
    const messages = await getMessagesToMe(maxResults);
    let messagesNew = 0;
    let selfMessagesSkipped = 0;
    let roomsChecked = 0;

    // 処理済みメッセージIDを取得（userIdが指定されている場合）
    const processedIds = userId ? await getProcessedMessageIds(userId) : new Set<string>();

    // Supabaseクライアントを取得
    const supabase = userId && isSupabaseAvailable() ? getSupabase() : null;

    for (const message of messages) {
      try {
        // 自分自身のメッセージは除外（無限ループ防止）
        if (message.account.account_id === myId) {
          selfMessagesSkipped++;
          continue;
        }

        // 既に処理済みのメッセージはスキップ
        if (processedIds.has(message.message_id)) {
          continue;
        }

        // メッセージ本文を抽出（Toタグなどを除去）
        const messageText = extractMessageText(message);

        // メッセージ詳細を記録
        const messageDetail = {
          message_id: message.message_id,
          room_id: message.room_id || null,
          sender: message.account.name,
          body: messageText.substring(0, 200), // 最初の200文字のみ
          send_time: new Date(message.send_time * 1000).toISOString()
        };
        details.push(messageDetail);

        // データベースに保存（userIdが指定されている場合）
        if (userId && supabase) {
          try {
            const insertData = {
              user_id: userId,
              source_type: 'chatwork' as const,
              source_message_id: message.message_id,
              thread_id: null, // ChatworkにはスレッドIDがない
              sender_identifier: message.account.account_id.toString(),
              sender_name: message.account.name || null,
              subject: null, // Chatworkには件名がない
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
            // 型アサーションを使用してSupabaseの型エラーを回避
            const { data: insertedData, error: dbError } = await (supabase.from('messages') as any).insert(insertData).select().single();

            if (dbError) {
              // 重複エラーは無視（既に処理済み）
              if (dbError.code !== '23505') {
                errors.push(`Database error for message ${message.message_id}: ${dbError.message}`);
              } else {
                continue;
              }
            } else {
              messagesNew++;
              const messageId = insertedData?.id;

              if (messageId) {
                // AIトリアージを実行（Chatworkにはスレッド履歴がない）
                try {
                  const triageResult = await triageMessage(
                    '', // Chatworkには件名がない
                    messageText
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

                  // LINE User IDを取得（effectiveLineUserIdを使用）
                  const lineUserIdForNotification = effectiveLineUserId;

                  // Type Aの場合はドラフト生成
                  let draft: string | undefined;
                  if (triageResult.type === 'A') {
                    try {
                      draft = await generateDraft(
                        '', // Chatworkには件名がない
                        messageText,
                        triageResult.type
                      );
                    } catch (draftError: any) {
                      console.warn(`Failed to generate draft for message ${message.message_id}:`, draftError.message);
                    }
                  }

                  // LINE通知を送信
                  if (lineUserIdForNotification) {
                    try {
                      await sendLineNotification(
                        lineUserIdForNotification,
                        messageId,
                        triageResult.type,
                        {
                          subject: undefined, // Chatworkには件名がない
                          body: messageText.substring(0, 500), // 最初の500文字のみ
                          sender: message.account.name || 'Unknown',
                          source: 'Chatwork'
                        },
                        draft
                      );
                    } catch (notifyError: any) {
                      errors.push(`Failed to send notification for message ${message.message_id}: ${notifyError.message}`);
                    }
                  }
                } catch (triageError: any) {
                  errors.push(`Failed to triage message ${message.message_id}: ${triageError.message}`);
                }

                // 処理済みとしてマーク
                await markMessageAsProcessed(userId, message.message_id);
              }
            }
          } catch (dbError: any) {
            errors.push(`Database error for message ${message.message_id}: ${dbError.message}`);
          }
        } else {
          // userIdが指定されていない場合は、メッセージを取得しただけ
          messagesNew++;
        }
      } catch (error: any) {
        errors.push(`Error processing message ${message.message_id}: ${error.message}`);
      }
    }

    // ルーム数をカウント（簡易版：実際には各メッセージのルームIDを集計する必要がある）
    roomsChecked = messages.length > 0 ? 1 : 0;

    return {
      summary: {
        users_processed: userId ? 1 : 0,
        rooms_checked: roomsChecked,
        messages_fetched: messages.length,
        messages_new: messagesNew,
        self_messages_skipped: selfMessagesSkipped,
        errors
      },
      details,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    errors.push(`Chatwork polling error: ${error.message}`);
    return {
      summary: {
        users_processed: 0,
        rooms_checked: 0,
        messages_fetched: 0,
        messages_new: 0,
        self_messages_skipped: 0,
        errors
      },
      details: [],
      processingTimeMs: Date.now() - startTime
    };
  }
}




