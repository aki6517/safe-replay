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
  room_id?: number; // ルームID（getMessagesToMeで追加される）
}

/**
 * Chatwork APIクライアントを作成
 * @param userApiToken - ユーザー固有のAPIトークン（per-user対応）
 */
function createChatworkClient(userApiToken?: string): ChatworkClientConfig | null {
  const apiToken = userApiToken || process.env.CHATWORK_API_TOKEN;
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

/** グローバルクライアント（環境変数ベース、後方互換用） */
let chatworkClient: ChatworkClientConfig | null = null;

/**
 * Chatwork APIクライアントが利用可能かチェック
 */
export function isChatworkClientAvailable(userApiToken?: string): boolean {
  if (userApiToken) return true;
  if (!chatworkClient) {
    chatworkClient = createChatworkClient();
  }
  return chatworkClient !== null;
}

/**
 * Chatwork APIクライアントを取得（利用可能でない場合はエラー）
 */
function getChatworkClient(userApiToken?: string): ChatworkClientConfig {
  if (userApiToken) {
    const client = createChatworkClient(userApiToken);
    if (!client) throw new Error('Chatwork API token not configured');
    return client;
  }
  if (!chatworkClient) {
    chatworkClient = createChatworkClient();
  }
  if (!chatworkClient) {
    throw new Error('Chatwork API token not configured');
  }
  return chatworkClient;
}

/**
 * ユーザー固有のChatworkクライアントを作成（マルチユーザーポーリング用）
 */
export function createChatworkClientForUser(apiToken: string): ChatworkClientConfig | null {
  return createChatworkClient(apiToken);
}

/**
 * APIリクエストを実行
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  userApiToken?: string
): Promise<T> {
  const client = getChatworkClient(userApiToken);
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
    const error = new Error(
      `Chatwork API error: ${response.status} ${response.statusText} - ${errorText}`
    );
    
    // 401エラー（認証エラー）の場合は緊急通知を送信
    if (response.status === 401) {
      try {
        const { notifyApiTokenExpired } = await import('../utils/emergency-notification');
        await notifyApiTokenExpired('Chatwork', errorText || 'Unauthorized');
      } catch (notifyError) {
        console.error('Failed to send emergency notification:', notifyError);
      }
    }
    
    throw error;
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
export async function getMyId(userApiToken?: string): Promise<number> {
  const client = getChatworkClient(userApiToken);

  // 環境変数で設定されている場合はそれを使用
  if (client.myId) {
    return client.myId;
  }

  try {
    const me = await apiRequest<{ account_id: number }>('/me', {}, userApiToken);
    return me.account_id;
  } catch (error) {
    console.error('Failed to get my Chatwork ID:', error);
    throw new Error('Failed to get my Chatwork ID');
  }
}

/**
 * 参加中のルーム一覧を取得
 */
export async function getRooms(userApiToken?: string): Promise<ChatworkRoom[]> {
  if (!isChatworkClientAvailable(userApiToken)) {
    throw new Error('Chatwork API token not configured');
  }

  try {
    const rooms = await apiRequest<ChatworkRoom[]>('/rooms', {}, userApiToken);
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
  roomId: number,
  userApiToken?: string
): Promise<ChatworkMessage[]> {
  if (!isChatworkClientAvailable(userApiToken)) {
    throw new Error('Chatwork API token not configured');
  }

  try {
    const messages = await apiRequest<ChatworkMessage[]>(
      `/rooms/${roomId}/messages?force=1`,
      { method: 'GET' },
      userApiToken
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
  myId: number,
  roomType?: string
): boolean {
  // ダイレクトチャットでは相手からの全メッセージを自分宛として扱う
  if (roomType === 'direct') {
    return message.account.account_id !== myId;
  }

  // メッセージ本文に「[To:自分のID]」が含まれているかチェック
  const toPattern = new RegExp(`\\[To:${myId}\\]`, 'g');
  return toPattern.test(message.body);
}

/**
 * 自分宛メッセージを取得（全ルームから）
 * 
 * @param maxResults - 取得する最大件数（デフォルト: 50）
 * @param daysBack - 過去何日間のメッセージを取得するか（デフォルト: 7日）
 * @returns 自分宛メッセージのリスト
 */
export async function getMessagesToMe(
  maxResults: number = 50,
  daysBack: number = 7,
  userApiToken?: string
): Promise<ChatworkMessage[]> {
  if (!isChatworkClientAvailable(userApiToken)) {
    throw new Error('Chatwork API token not configured');
  }

  try {
    // 自分のIDを取得
    const myId = await getMyId(userApiToken);

    // 日付フィルタリング用のタイムスタンプを計算（過去N日間）
    const cutoffTimestamp = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);

    // ルーム一覧を取得
    const rooms = await getRooms(userApiToken);
    const messagesToMe: ChatworkMessage[] = [];

    // API制限回避のため、未読またはメンションのあるルームのみ対象にする
    const candidateRooms = rooms
      .filter((room) => room.unread_num > 0 || room.mention_num > 0)
      .sort((a, b) => (b.mention_num + b.unread_num) - (a.mention_num + a.unread_num));

    // 各ルームからメッセージを取得
    for (const room of candidateRooms) {
      try {
        const messages = await getRoomMessages(room.room_id, userApiToken);

        // 自分宛メッセージをフィルタリング
        for (const message of messages) {
          // 日付フィルタリング：過去N日間のメッセージのみ処理
          if (message.send_time < cutoffTimestamp) {
            continue;
          }

          // 自分宛メッセージかチェック
          if (isMessageToMe(message, myId, room.type)) {
            // 自分自身のメッセージは除外（無限ループ防止）
            if (message.account.account_id !== myId) {
              // ルームIDを追加
              messagesToMe.push({
                ...message,
                room_id: room.room_id
              });
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

/**
 * Chatworkでメッセージを送信
 * 
 * @param roomId - ルームID
 * @param message - 送信するメッセージ
 * @returns 送信成功時true
 */
export async function sendChatworkMessage(
  roomId: number,
  message: string,
  userApiToken?: string
): Promise<boolean> {
  if (!isChatworkClientAvailable(userApiToken)) {
    console.error('Chatwork API token not configured');
    return false;
  }

  try {
    const response = await fetch(
      `${CHATWORK_API_BASE}/rooms/${roomId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': getChatworkClient(userApiToken).apiToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          body: message
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Chatwork API error: ${response.status} ${response.statusText} - ${errorText}`);
      
      // 401エラー（認証エラー）の場合は緊急通知を送信
      if (response.status === 401) {
        try {
          const { notifyApiTokenExpired } = await import('../utils/emergency-notification');
          await notifyApiTokenExpired('Chatwork', errorText || 'Unauthorized');
        } catch (notifyError) {
          console.error('Failed to send emergency notification:', notifyError);
        }
      }
      
      throw error;
    }

    console.log('[Chatwork送信成功]', { roomId });
    return true;
  } catch (error: any) {
    console.error('[Chatwork送信失敗]', { roomId, error: error.message });
    
    // 401エラーの場合は既に緊急通知が送信されているので、ここでは再送信しない
    return false;
  }
}
