/**
 * LINE Messaging API サービス
 */
import { Client, ClientConfig } from '@line/bot-sdk';

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

