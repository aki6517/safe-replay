/**
 * LINE Webhook エンドポイント
 */
import { Hono } from 'hono';
import crypto from 'crypto';
import { isLineClientAvailable } from '../services/line';
import { processForwardedMessage } from '../services/message-processor';
import { handleLineAction } from '../services/action-handler';

export const lineWebhook = new Hono();

// LINE署名検証
function verifyLineSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return false;
  }

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
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

    if (!signature || !verifyLineSignature(body, signature)) {
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

    const events = JSON.parse(body).events || [];

    for (const event of events) {
      const eventType = event.type;
      const userId = event.source?.userId;

      if (!userId) {
        continue;
      }

      // ホワイトリストチェック（簡易版、後で実装）
      // TODO: ホワイトリスト検証を追加

      if (eventType === 'message') {
        const messageType = event.message?.type;

        if (messageType === 'text') {
          // 転送メッセージ処理
          const text = event.message.text;
          await processForwardedMessage(userId, text);
        } else if (messageType === 'file') {
          // ファイル受信処理（将来実装）
          console.log('File message received:', event.message);
        }
      } else if (eventType === 'postback') {
        // アクションボタン処理
        const data = event.postback?.data || '';
        await handleLineAction(userId, data);
      } else if (eventType === 'follow') {
        // ユーザー登録
        console.log('User followed:', userId);
        // TODO: ユーザー登録処理
      } else if (eventType === 'unfollow') {
        // ユーザー無効化
        console.log('User unfollowed:', userId);
        // TODO: ユーザー無効化処理
      }
    }

    return c.json({
      status: 'ok',
      processed: events.length
    });
  } catch (error: any) {
    console.error('LINE Webhook error:', error);
    return c.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      },
      500
    );
  }
});

