/**
 * LINE Messaging API サービス
 */
import { Client, ClientConfig, TextMessage } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;

// 開発環境では環境変数が設定されていない場合でもエラーを投げない
let lineClient: Client | null = null;

if (channelAccessToken && channelSecret) {
  const config: ClientConfig = {
    channelAccessToken,
    channelSecret
  };
  lineClient = new Client(config);
} else {
  console.warn('⚠️  LINE Messaging API credentials not configured');
}

export { lineClient };

// クライアントが利用可能かチェックする関数
export function isLineClientAvailable(): boolean {
  return lineClient !== null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getLineClient(): Client {
  if (!lineClient) {
    throw new Error('LINE Messaging API credentials not configured');
  }
  return lineClient;
}

/**
 * テキストメッセージを送信（プッシュメッセージ）
 * 
 * @param userId - LINE User ID
 * @param text - 送信するテキスト
 * @returns 成功時true、失敗時false
 */
export async function sendTextMessage(userId: string, text: string): Promise<boolean> {
  if (!isLineClientAvailable()) {
    console.error('LINE Messaging API credentials not configured');
    return false;
  }

  try {
    const client = getLineClient();
    const message: TextMessage = {
      type: 'text',
      text
    };
    await client.pushMessage(userId, message);
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
  if (!isLineClientAvailable()) {
    console.error('LINE Messaging API credentials not configured');
    return false;
  }

  try {
    const client = getLineClient();
    const message: TextMessage = {
      type: 'text',
      text
    };
    await client.replyMessage(replyToken, message);
    return true;
  } catch (error) {
    console.error('LINEメッセージ返信エラー:', error);
    return false;
  }
}

