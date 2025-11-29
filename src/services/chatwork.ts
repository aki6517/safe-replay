/**
 * Chatwork API サービス
 */
const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

/**
 * Chatwork APIクライアントの設定
 */
interface ChatworkClientConfig {
  apiToken: string;
  myId?: number; // 自分のChatwork ID（無限ループ防止用）
}

/**
 * Chatworkルーム情報の型定義
 */
export interface ChatworkRoom {
  room_id: number;
  name: string;
  type: string;
  role: string;
  sticky: boolean;
  unread_num: number;
  mention_num: number;
  mytask_num: number;
  message_num: number;
  file_num: number;
  task_num: number;
  icon_path: string;
  last_update_time: number;
}

/**
 * Chatworkメッセージ情報の型定義
 */
export interface ChatworkMessage {
  message_id: string;
  account: {
    account_id: number;
    name: string;
    avatar_path: string;
  };
  body: string;
  send_time: number;
  update_time: number;
}

/**
 * Chatwork APIクライアントを作成
 */
function createChatworkClient(): ChatworkClientConfig | null {
  // 環境変数から認証情報を取得（関数内で読み込むことで、dotenv.config()後に確実に読み込まれる）
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const myIdStr = process.env.CHATWORK_MY_ID;

  if (!apiToken) {
    console.warn('⚠️  Chatwork API token not configured');
    return null;
  }

  const myId = myIdStr ? parseInt(myIdStr, 10) : undefined;

  return {
    apiToken,
    myId
  };
}

let chatworkClient: ChatworkClientConfig | null = null;

/**
 * Chatwork APIクライアントが利用可能かチェック
 */
export function isChatworkClientAvailable(): boolean {
  if (!chatworkClient) {
    chatworkClient = createChatworkClient();
  }
  return chatworkClient !== null;
}

/**
 * Chatwork APIクライアントを取得（利用可能でない場合はエラー）
 */
function getChatworkClient(): ChatworkClientConfig {
  if (!chatworkClient) {
    chatworkClient = createChatworkClient();
  }
  if (!chatworkClient) {
    throw new Error('Chatwork API token not configured');
  }
  return chatworkClient;
}

/**
 * APIリクエストを実行
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const client = getChatworkClient();
  const url = `${CHATWORK_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-ChatWorkToken': client.apiToken,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Chatwork API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  // 空のレスポンスの場合は空配列を返す
  const text = await response.text();
  if (!text.trim()) {
    return [] as T;
  }

  return JSON.parse(text) as T;
}

/**
 * 自分のChatwork IDを取得
 */
export async function getMyId(): Promise<number> {
  const client = getChatworkClient();

  // 環境変数で設定されている場合はそれを使用
  if (client.myId) {
    return client.myId;
  }

  try {
    const me = await apiRequest<{ account_id: number }>('/me');
    return me.account_id;
  } catch (error) {
    console.error('Failed to get my Chatwork ID:', error);
    throw new Error('Failed to get my Chatwork ID');
  }
}

/**
 * 参加中のルーム一覧を取得
 */
export async function getRooms(): Promise<ChatworkRoom[]> {
  if (!isChatworkClientAvailable()) {
    throw new Error('Chatwork API token not configured');
  }

  try {
    const rooms = await apiRequest<ChatworkRoom[]>('/rooms');
    return rooms || [];
  } catch (error) {
    console.error('Failed to get Chatwork rooms:', error);
    throw error;
  }
}

/**
 * 特定ルームのメッセージを取得
 * 
 * @param roomId - ルームID
 * @returns メッセージのリスト
 */
export async function getRoomMessages(
  roomId: number
): Promise<ChatworkMessage[]> {
  if (!isChatworkClientAvailable()) {
    throw new Error('Chatwork API token not configured');
  }

  try {
    const messages = await apiRequest<ChatworkMessage[]>(
      `/rooms/${roomId}/messages`,
      {
        method: 'GET'
      }
    );
    return messages || [];
  } catch (error) {
    console.error(`Failed to get messages for room ${roomId}:`, error);
    throw error;
  }
}

/**
 * 自分宛メッセージかどうかを判定
 * 
 * @param message - メッセージオブジェクト
 * @param myId - 自分のChatwork ID
 * @returns 自分宛メッセージの場合true
 */
export function isMessageToMe(
  message: ChatworkMessage,
  myId: number
): boolean {
  // メッセージ本文に「[To:自分のID]」が含まれているかチェック
  const toPattern = new RegExp(`\\[To:${myId}\\]`, 'g');
  return toPattern.test(message.body);
}

/**
 * 自分宛メッセージを取得（全ルームから）
 * 
 * @param maxResults - 取得する最大件数（デフォルト: 50）
 * @returns 自分宛メッセージのリスト
 */
export async function getMessagesToMe(
  maxResults: number = 50
): Promise<ChatworkMessage[]> {
  if (!isChatworkClientAvailable()) {
    throw new Error('Chatwork API token not configured');
  }

  try {
    // 自分のIDを取得
    const myId = await getMyId();

    // ルーム一覧を取得
    const rooms = await getRooms();
    const messagesToMe: ChatworkMessage[] = [];

    // 各ルームからメッセージを取得
    for (const room of rooms) {
      try {
        const messages = await getRoomMessages(room.room_id);

        // 自分宛メッセージをフィルタリング
        for (const message of messages) {
          // 自分宛メッセージかチェック
          if (isMessageToMe(message, myId)) {
            // 自分自身のメッセージは除外（無限ループ防止）
            if (message.account.account_id !== myId) {
              messagesToMe.push(message);
            }
          }

          // 最大件数に達したら終了
          if (messagesToMe.length >= maxResults) {
            break;
          }
        }

        // 最大件数に達したら終了
        if (messagesToMe.length >= maxResults) {
          break;
        }
      } catch (error) {
        console.error(`Failed to get messages from room ${room.room_id}:`, error);
        // エラーが発生しても次のルームを処理
        continue;
      }
    }

    return messagesToMe;
  } catch (error) {
    console.error('Failed to get messages to me:', error);
    throw error;
  }
}

/**
 * メッセージ本文からテキストを抽出（Toタグなどを除去）
 */
export function extractMessageText(message: ChatworkMessage): string {
  let text = message.body;

  // [To:数字]タグを除去
  text = text.replace(/\[To:\d+\]/g, '');

  // [rp aid=数字]タグを除去（返信タグ）
  text = text.replace(/\[rp aid=\d+\]/g, '');

  // その他のタグを除去（簡易版）
  text = text.replace(/\[.*?\]/g, '');

  // 余分な空白を整理
  text = text.trim().replace(/\s+/g, ' ');

  return text;
}

