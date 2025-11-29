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
 * Chatworkポーリング処理
 */
export async function pollChatwork(
  userId?: string,
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
          room_id: message.account.account_id, // 簡易版（実際はルームIDが必要）
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
                room_id: message.account.account_id, // 簡易版
                account_id: message.account.account_id,
                avatar_path: message.account.avatar_path,
                update_time: message.update_time
              } as Record<string, unknown>
            };
            // 型アサーションを使用してSupabaseの型エラーを回避
            const { error: dbError } = await (supabase.from('messages') as any).insert(insertData);

            if (dbError) {
              // 重複エラーは無視（既に処理済み）
              if (dbError.code !== '23505') {
                errors.push(`Database error for message ${message.message_id}: ${dbError.message}`);
              } else {
                continue;
              }
            } else {
              messagesNew++;
              // 処理済みとしてマーク
              await markMessageAsProcessed(userId, message.message_id);
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




