/**
 * LINE Webhook エンドポイント
 */
import { Hono } from 'hono';
import { isLineClientAvailable, replyTextMessage } from '../services/line';
import { processForwardedMessage } from '../services/message-processor';
import { handleLineAction, handleEditModeMessage } from '../services/action-handler';
import { isUserAllowedSync } from '../utils/security';
import { getEditMode } from '../services/edit-mode';
import { getSupabase, isSupabaseAvailable } from '../db/client';
import type {
  LineWebhookRequest,
  LineWebhookEvent,
  MessageEvent,
  PostbackEvent
} from '../types/line-webhook';

export const lineWebhook = new Hono();

function decodeBase64(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }

  const bufferCtor = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(value, 'base64'));
  }

  throw new Error('No base64 decoder available');
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// LINE署名検証
async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const expected = new Uint8Array(digest);
    const received = decodeBase64(signature);
    return timingSafeEqual(expected, received);
  } catch (error) {
    console.error('[LINE署名検証エラー]', error);
    return false;
  }
}

lineWebhook.post('/webhook', async (c) => {
  try {
    // LINEクライアントの確認
    if (!isLineClientAvailable()) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'LINE Messaging API credentials not configured'
          }
        },
        503
      );
    }

    // 署名検証
    const signature = c.req.header('X-Line-Signature');
    const body = await c.req.text();

    if (!signature || !(await verifyLineSignature(body, signature))) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'LINE signature verification failed'
          }
        },
        401
      );
    }

    const webhookRequest: LineWebhookRequest = JSON.parse(body);
    const events: LineWebhookEvent[] = webhookRequest.events || [];

    for (const event of events) {
      const eventType = event.type;
      const userId = event.source?.userId;

      if (!userId) {
        continue;
      }

      // ホワイトリストチェック
      if (!isUserAllowedSync(userId)) {
        console.warn(`[セキュリティ] 許可されていないユーザーからのアクセス: ${userId}`);
        // 403 Forbiddenを返す（ただし、LINE Webhookの仕様上200を返す必要がある場合もある）
        // ここでは処理をスキップして続行（ログに記録）
        continue;
      }

      if (eventType === 'message') {
        const messageEvent = event as MessageEvent;
        const messageType = messageEvent.message?.type;

        if (messageType === 'text' && messageEvent.message.text) {
          const text = messageEvent.message.text;
          
          // 編集モード中かチェック
          const editModeData = await getEditMode(userId);
          if (editModeData) {
            // 編集モード中：修正指示として処理
            await handleEditModeMessage(userId, text, editModeData);
          } else {
            // 通常モード：転送メッセージ処理
            await processForwardedMessage(userId, text);
          }
        } else if (messageType === 'file') {
          // ファイル受信処理（将来実装）
          console.log('File message received:', messageEvent.message);
        }
      } else if (eventType === 'postback') {
        // アクションボタン処理
        const postbackEvent = event as PostbackEvent;
        const data = postbackEvent.postback?.data || '';
        await handleLineAction(userId, data);
      } else if (eventType === 'follow') {
        // ユーザー登録とウェルカムメッセージ
        console.log('User followed:', userId);

        // DBにユーザーを自動登録（既存なら再アクティブ化）
        try {
          if (isSupabaseAvailable()) {
            const supabase = getSupabase();
            // 既存ユーザーを確認
            const { data: existing } = await (supabase.from('users') as any)
              .select('id, status')
              .eq('line_user_id', userId)
              .single();

            if (existing) {
              // 既存ユーザー → 再フォロー時はpendingに戻す（削除済みの場合）
              if (existing.status === 'deleted' || existing.status === 'suspended') {
                await (supabase.from('users') as any)
                  .update({ status: 'pending', updated_at: new Date().toISOString() })
                  .eq('id', existing.id);
                console.log(`User reactivated: ${userId} → pending`);
              }
            } else {
              // 新規ユーザー作成（pending状態）
              const { error: insertError } = await (supabase.from('users') as any)
                .insert({
                  line_user_id: userId,
                  status: 'pending',
                  is_active: true
                });
              if (insertError) {
                console.error('Failed to create user:', insertError);
              } else {
                console.log(`New user created: ${userId} (pending)`);
              }
            }
          }
        } catch (dbError) {
          console.error('DB error during user registration:', dbError);
        }

        // ウェルカムメッセージ + LIFF設定画面への誘導
        const liffId = process.env.LIFF_ID || '';
        const liffUrl = liffId ? `\n\n初期設定はこちら：\nhttps://liff.line.me/${liffId}` : '';
        const welcomeMessage = `SafeReplyへようこそ！\n\nメッセージを転送すると、AIが自動で返信ドラフトを作成します。${liffUrl}`;

        if (event.replyToken) {
          await replyTextMessage(event.replyToken, welcomeMessage);
        } else {
          const { sendTextMessage } = await import('../services/line');
          await sendTextMessage(userId, welcomeMessage);
        }
      } else if (eventType === 'unfollow') {
        // ユーザー無効化
        console.log('User unfollowed:', userId);
        try {
          if (isSupabaseAvailable()) {
            const supabase = getSupabase();
            await (supabase.from('users') as any)
              .update({ status: 'deleted', updated_at: new Date().toISOString() })
              .eq('line_user_id', userId);
            console.log(`User deactivated: ${userId} → deleted`);
          }
        } catch (dbError) {
          console.error('DB error during user deactivation:', dbError);
        }
      }
    }

    return c.json({
      status: 'ok',
      processed: events.length
    });
  } catch (error) {
    console.error('LINE Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: errorMessage
        }
      },
      500
    );
  }
});
