/**
 * Gmailポーリングサービス
 */
import {
  getUnreadMessages,
  extractMessageBody,
  extractMessageHeaders,
  isGmailClientAvailable
} from '../gmail';
import { redis, isRedisAvailable } from '../../db/redis';
import { supabase } from '../../db/client';

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
 * Gmailポーリング処理
 */
export async function pollGmail(
  userId?: string,
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
    // 未読メールを取得
    const messages = await getUnreadMessages(maxResults);
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
          continue;
        }

        // メッセージ本文とヘッダーを抽出
        const body = extractMessageBody(message);
        const headers = extractMessageHeaders(message);

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
        if (userId && supabase) {
          try {
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
              received_at: new Date(parseInt(message.internalDate)).toISOString(),
              status: 'pending' as const,
              metadata: {
                labelIds: message.labelIds,
                snippet: message.snippet
              } as Record<string, unknown>
            };
            // 型アサーションを使用してSupabaseの型エラーを回避
            const { error: dbError } = await (supabase.from('messages') as any).insert(insertData);

            if (dbError) {
              // 重複エラーは無視（既に処理済み）
              if (dbError.code !== '23505') {
                errors.push(`Database error for message ${message.id}: ${dbError.message}`);
              } else {
                messagesSkipped++;
                continue;
              }
            } else {
              messagesNew++;
              // 処理済みとしてマーク
              await markMessageAsProcessed(userId, message.id);
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
            part => part.filename && part.filename.length > 0
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

