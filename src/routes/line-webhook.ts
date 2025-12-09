/**
 * LINE Webhook エンドポイント
 */
import { Hono } from 'hono';
import crypto from 'crypto';
import { isLineClientAvailable, replyTextMessage } from '../services/line';
import { processForwardedMessage } from '../services/message-processor';
import { handleLineAction, handleEditModeMessage } from '../services/action-handler';
import { isUserAllowedSync } from '../utils/security';
import { getEditMode } from '../services/edit-mode';
import type {
  LineWebhookRequest,
  LineWebhookEvent,
  MessageEvent,
  PostbackEvent
} from '../types/line-webhook';

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
        console.log('Follow event details:', JSON.stringify(event, null, 2));
        
        // ウェルカムメッセージを送信
        if (event.replyToken) {
          console.log('Sending welcome message with replyToken:', event.replyToken);
          const welcomeMessage = 'SafeReplyへようこそ！\n\nメッセージを転送すると、AIが自動で返信ドラフトを作成します。';
          const success = await replyTextMessage(event.replyToken, welcomeMessage);
          if (success) {
            console.log('Welcome message sent successfully');
          } else {
            console.error('Failed to send welcome message');
          }
        } else {
          console.warn('No replyToken found in follow event, using push message instead');
          // replyTokenがない場合はプッシュメッセージを使用
          const welcomeMessage = 'SafeReplyへようこそ！\n\nメッセージを転送すると、AIが自動で返信ドラフトを作成します。';
          const { sendTextMessage } = await import('../services/line');
          const success = await sendTextMessage(userId, welcomeMessage);
          if (success) {
            console.log('Welcome message sent via push message');
          } else {
            console.error('Failed to send welcome message via push message');
          }
        }
        
        // TODO: ユーザー登録処理（データベースへの登録は後で実装）
      } else if (eventType === 'unfollow') {
        // ユーザー無効化
        console.log('User unfollowed:', userId);
        // TODO: ユーザー無効化処理（データベースでの無効化は後で実装）
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

