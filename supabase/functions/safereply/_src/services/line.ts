/**
 * LINE Messaging API サービス
 */
import type { FlexMessage, LineMessage, TextMessage } from '../types/line-messaging.ts';

const LINE_MESSAGE_API_BASE_URL = 'https://api.line.me/v2/bot/message';

type LineConfig = {
  channelAccessToken: string;
  channelSecret: string;
};

function getLineConfig(): LineConfig | null {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    return null;
  }

  return { channelAccessToken, channelSecret };
}

async function callLineMessagingApi(path: string, payload: Record<string, unknown>): Promise<void> {
  const config = getLineConfig();
  if (!config) {
    throw new Error('LINE Messaging API credentials not configured');
  }

  const response = await fetch(`${LINE_MESSAGE_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.channelAccessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `LINE Messaging API request failed: ${response.status} ${response.statusText} ${errorBody}`
    );
  }
}

// クライアントが利用可能かチェックする関数
export function isLineClientAvailable(): boolean {
  return getLineConfig() !== null;
}

/**
 * テキストメッセージを送信（プッシュメッセージ）
 * 
 * @param userId - LINE User ID
 * @param text - 送信するテキスト
 * @returns 成功時true、失敗時false
 */
export async function sendTextMessage(userId: string, text: string): Promise<boolean> {
  try {
    const message: TextMessage = {
      type: 'text',
      text
    };
    await callLineMessagingApi('/push', {
      to: userId,
      messages: [message]
    });
    return true;
  } catch (error) {
    console.error('LINEメッセージ送信エラー:', error);
    return false;
  }
}

/**
 * テキストメッセージを返信（リプライメッセージ）
 * 
 * @param replyToken - リプライトークン
 * @param text - 送信するテキスト
 * @returns 成功時true、失敗時false
 */
export async function replyTextMessage(replyToken: string, text: string): Promise<boolean> {
  try {
    const message: TextMessage = {
      type: 'text',
      text
    };
    await callLineMessagingApi('/reply', {
      replyToken,
      messages: [message]
    });
    return true;
  } catch (error) {
    console.error('LINEメッセージ返信エラー:', error);
    return false;
  }
}

/**
 * Flex Messageを送信（プッシュメッセージ）
 * 
 * @param userId - LINE User ID
 * @param flexMessage - Flex Messageオブジェクト
 * @param options - 送信オプション（通知音の設定など）
 * @returns 成功時true、失敗時false
 */
export async function sendFlexMessage(
  userId: string,
  flexMessage: FlexMessage,
  options?: {
    notificationDisabled?: boolean; // 静音通知（通知音を無効化）
  }
): Promise<boolean> {
  try {
    await callLineMessagingApi('/push', {
      to: userId,
      messages: [flexMessage as LineMessage],
      notificationDisabled: options?.notificationDisabled ?? false
    });
    return true;
  } catch (error) {
    console.error('LINE Flex Message送信エラー:', error);
    return false;
  }
}
