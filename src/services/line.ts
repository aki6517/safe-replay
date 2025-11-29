/**
 * LINE Messaging API サービス
 */
import { Client, ClientConfig, TextMessage, FlexMessage } from '@line/bot-sdk';

// 開発環境では環境変数が設定されていない場合でもエラーを投げない
let lineClient: Client | null = null;

/**
 * LINEクライアントを初期化（遅延初期化）
 */
function initializeLineClient(): void {
  if (lineClient !== null) {
    return; // 既に初期化済み
  }

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (channelAccessToken && channelSecret) {
    const config: ClientConfig = {
      channelAccessToken,
      channelSecret
    };
    lineClient = new Client(config);
  } else {
    console.warn('⚠️  LINE Messaging API credentials not configured');
  }
}

// モジュール読み込み時に一度初期化を試みる
initializeLineClient();

export { lineClient };

// クライアントが利用可能かチェックする関数
export function isLineClientAvailable(): boolean {
  // 再初期化を試みる（環境変数が後から設定された場合に対応）
  if (lineClient === null) {
    initializeLineClient();
  }
  return lineClient !== null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getLineClient(): Client {
  // 再初期化を試みる（環境変数が後から設定された場合に対応）
  if (lineClient === null) {
    initializeLineClient();
  }
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
  if (!isLineClientAvailable()) {
    console.error('LINE Messaging API credentials not configured');
    return false;
  }

  try {
    const client = getLineClient();
    // LINE Bot SDKのpushMessageは第3引数にnotificationDisabledを直接渡す
    await client.pushMessage(userId, flexMessage, options?.notificationDisabled ?? false);
    return true;
  } catch (error) {
    console.error('LINE Flex Message送信エラー:', error);
    return false;
  }
}

