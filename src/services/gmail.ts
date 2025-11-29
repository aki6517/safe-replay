/**
 * Gmail API サービス
 */
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

/**
 * Gmail APIクライアントを初期化
 */
function createGmailClient(): gmail_v1.Gmail | null {
  // 環境変数から認証情報を取得（関数内で読み込むことで、dotenv.config()後に確実に読み込まれる）
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('⚠️  Gmail API credentials not configured');
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // リダイレクトURI（OAuth 2.0 for Server to Server）
    );

    // リフレッシュトークンを設定
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // トークンを自動リフレッシュ
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        // リフレッシュトークンが更新された場合は保存が必要（将来実装）
        console.log('Refresh token updated');
      }
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    return gmail;
  } catch (error) {
    console.error('Gmail API client initialization error:', error);
    return null;
  }
}

let gmailClient: gmail_v1.Gmail | null = null;

// クライアントが利用可能かチェックする関数
export function isGmailClientAvailable(): boolean {
  if (!gmailClient) {
    gmailClient = createGmailClient();
  }
  return gmailClient !== null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getGmailClient(): gmail_v1.Gmail {
  if (!gmailClient) {
    gmailClient = createGmailClient();
  }
  if (!gmailClient) {
    throw new Error('Gmail API credentials not configured');
  }
  return gmailClient;
}

/**
 * Gmailメッセージの型定義
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload?: gmail_v1.Schema$MessagePart;
  sizeEstimate?: number;
  raw?: string;
}

/**
 * 未読メールを取得
 * 
 * @param maxResults - 取得する最大件数（デフォルト: 50）
 * @returns 未読メールのリスト
 */
export async function getUnreadMessages(maxResults: number = 50): Promise<GmailMessage[]> {
  if (!isGmailClientAvailable()) {
    throw new Error('Gmail API credentials not configured');
  }

  const client = getGmailClient();

  try {
    // 未読メールのリストを取得
    const response = await client.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults
    });

    const messages = response.data.messages || [];
    const messageDetails: GmailMessage[] = [];

    // 各メッセージの詳細を取得
    for (const message of messages) {
      if (!message.id) {
        continue;
      }

      try {
        const detailResponse = await client.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const messageData = detailResponse.data;
        messageDetails.push({
          id: messageData.id || '',
          threadId: messageData.threadId || '',
          labelIds: messageData.labelIds || [],
          snippet: messageData.snippet || '',
          historyId: messageData.historyId || '',
          internalDate: messageData.internalDate || '',
          payload: messageData.payload,
          sizeEstimate: messageData.sizeEstimate ?? undefined,
          raw: messageData.raw ?? undefined
        });
      } catch (error) {
        console.error(`Failed to get message details for ${message.id}:`, error);
        // エラーが発生しても次のメッセージの処理を続ける
      }
    }

    return messageDetails;
  } catch (error) {
    console.error('Gmail API error:', error);
    throw error;
  }
}

/**
 * スレッド履歴を取得
 * 
 * @param threadId - スレッドID
 * @returns スレッド内のメッセージリスト
 */
export async function getThreadHistory(threadId: string): Promise<GmailMessage[]> {
  if (!isGmailClientAvailable()) {
    throw new Error('Gmail API credentials not configured');
  }

  const client = getGmailClient();

  try {
    const response = await client.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    const thread = response.data;
    const messages: GmailMessage[] = [];

    if (thread.messages) {
      for (const message of thread.messages) {
        messages.push({
          id: message.id || '',
          threadId: message.threadId || '',
          labelIds: message.labelIds || [],
          snippet: message.snippet || '',
          historyId: message.historyId || '',
          internalDate: message.internalDate || '',
          payload: message.payload,
          sizeEstimate: message.sizeEstimate ?? undefined,
          raw: message.raw ?? undefined
        });
      }
    }

    return messages;
  } catch (error) {
    console.error(`Failed to get thread history for ${threadId}:`, error);
    throw error;
  }
}

/**
 * メッセージ本文を抽出
 * 
 * @param message - Gmailメッセージ
 * @returns 抽出されたテキスト本文
 */
export function extractMessageBody(message: GmailMessage): string {
  if (!message.payload) {
    return message.snippet || '';
  }

  let textBody = '';
  let htmlBody = '';

  // メッセージ本文を再帰的に抽出
  function extractPart(part: gmail_v1.Schema$MessagePart): void {
    if (part.body?.data) {
      const decodedData = Buffer.from(part.body.data, 'base64').toString('utf-8');
      if (part.mimeType === 'text/plain') {
        textBody = decodedData;
      } else if (part.mimeType === 'text/html') {
        htmlBody = decodedData;
      }
    }

    // マルチパートメッセージの場合、各パートを処理
    if (part.parts) {
      for (const subPart of part.parts) {
        extractPart(subPart);
      }
    }
  }

  extractPart(message.payload);

  // テキスト本文を優先、なければHTMLからテキストを抽出（簡易版）
  if (textBody) {
    return textBody;
  } else if (htmlBody) {
    // HTMLタグを削除（簡易版）
    return htmlBody.replace(/<[^>]*>/g, '').trim();
  }

  // 本文が取得できない場合はスニペットを返す
  return message.snippet || '';
}

/**
 * メッセージのヘッダー情報を抽出
 * 
 * @param message - Gmailメッセージ
 * @returns ヘッダー情報
 */
export function extractMessageHeaders(message: GmailMessage): {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
} {
  if (!message.payload?.headers) {
    return {};
  }

  const headers: Record<string, string> = {};
  for (const header of message.payload.headers) {
    if (header.name && header.value) {
      headers[header.name.toLowerCase()] = header.value;
    }
  }

  return {
    from: headers['from'],
    to: headers['to'],
    subject: headers['subject'],
    date: headers['date']
  };
}

