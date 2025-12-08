/**
 * Gmail API サービス
 * 
 * Gmail APIを使用したメール取得・送信機能を提供
 */
import { google } from 'googleapis';
import { gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { notifyApiTokenExpired } from '../utils/emergency-notification';

// Gmail APIクライアントのシングルトンインスタンス
let gmailClient: gmail_v1.Gmail | null = null;
let oauth2Client: OAuth2Client | null = null;

/**
 * リフレッシュトークン失効エラーかどうかを判定
 */
function isTokenExpiredError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString();
  const errorCode = error.code;
  
  // 一般的なトークン失効エラーメッセージ
  const expiredPatterns = [
    'invalid_grant',
    'Token has been expired',
    'Token has been revoked',
    'invalid_token',
    'unauthorized_client',
    'access_denied'
  ];
  
  return expiredPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
    errorCode === pattern
  );
}

/**
 * Gmail APIエラーを処理し、必要に応じてLINE通知を送信
 */
async function handleGmailApiError(error: any, operation: string): Promise<void> {
  if (isTokenExpiredError(error)) {
    console.error(`[Gmail API] トークン失効エラー検出: ${operation}`, {
      error: error.message,
      code: error.code
    });
    
    // 再認証用のURLを生成
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    let authUrl: string | undefined;
    
    if (clientId && clientSecret) {
      try {
        const { google } = await import('googleapis');
        const tempOAuth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          'urn:ietf:wg:oauth:2.0:oob'
        );
        authUrl = tempOAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/gmail.readonly'],
          prompt: 'consent'
        });
      } catch (urlError) {
        console.error('[Gmail API] 認証URL生成エラー:', urlError);
      }
    }
    
    // LINE緊急通知を送信（重複防止機能が組み込まれている）
    await notifyApiTokenExpired(
      'Gmail',
      error.message || 'Token has been expired or revoked.',
      authUrl
    );
    
    // クライアントをリセット（次回初期化時に再試行）
    gmailClient = null;
    oauth2Client = null;
  } else {
    console.error(`[Gmail API] エラー: ${operation}`, {
      error: error.message,
      code: error.code
    });
  }
}

/**
 * Gmail APIクライアントを初期化
 */
function initializeGmailClient(): gmail_v1.Gmail | null {
  if (gmailClient) {
    return gmailClient;
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // トークン自動リフレッシュの設定
    // googleapisライブラリは自動的にアクセストークンをリフレッシュしますが、
    // リフレッシュトークン自体が失効した場合はエラーが発生します
    
    gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
    return gmailClient;
  } catch (error) {
    console.error('Failed to initialize Gmail client:', error);
    return null;
  }
}

/**
 * Gmail APIクライアントが利用可能かチェック
 */
export function isGmailClientAvailable(): boolean {
  const client = initializeGmailClient();
  return client !== null;
}

/**
 * メッセージの型定義
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: gmail_v1.Schema$MessagePart;
  internalDate?: string;
  labelIds?: string[];
}

/**
 * メッセージヘッダーの型定義
 */
export interface MessageHeaders {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  messageId?: string;
}

/**
 * 過去指定日数分のメールを取得（迷惑メール・ゴミ箱を除外）
 * 
 * @param maxResults - 取得する最大件数（デフォルト: 50）
 * @param daysBack - 過去何日分のメールを取得するか（デフォルト: 3）
 * @returns メールの配列
 */
export async function getUnreadMessages(maxResults: number = 50, daysBack: number = 3): Promise<GmailMessage[]> {
  const client = initializeGmailClient();
  if (!client) {
    throw new Error('Gmail API client is not available');
  }

  try {
    // 過去N日前の日時を計算（UNIXタイムスタンプ（秒））
    const now = Date.now();
    const daysAgo = new Date(now - daysBack * 24 * 60 * 60 * 1000);
    const daysAgoUnixSeconds = Math.floor(daysAgo.getTime() / 1000);
    
    // Gmail APIクエリ: 過去N日分のメールを取得し、迷惑メール・ゴミ箱・削除済みを除外
    // -in:spam: 迷惑メールを除外
    // -in:trash: ゴミ箱を除外
    // -is:deleted: 削除済みを除外
    // after: 指定日時以降のメールを取得
    const query = `after:${daysAgoUnixSeconds} -in:spam -in:trash -is:deleted`;
    
    // メールのリストを取得
    const response = await client.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 500) // Gmail APIの上限は500
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

    // 各メッセージの詳細を取得
    const messagePromises = response.data.messages.map(async (msg) => {
      if (!msg.id) {
        return null;
      }

      try {
        const messageResponse = await client.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        return {
          id: messageResponse.data.id || '',
          threadId: messageResponse.data.threadId || '',
          snippet: messageResponse.data.snippet || '',
          payload: messageResponse.data.payload,
          internalDate: messageResponse.data.internalDate,
          labelIds: messageResponse.data.labelIds || []
        } as GmailMessage;
      } catch (error: any) {
        console.error(`Failed to get message ${msg.id}:`, error.message);
        return null;
      }
    });

    const messages = await Promise.all(messagePromises);
    return messages.filter((msg): msg is GmailMessage => msg !== null);
  } catch (error: any) {
    await handleGmailApiError(error, 'getUnreadMessages');
    throw new Error(`Gmail API error: ${error.message}`);
  }
}

/**
 * メッセージヘッダーを抽出
 * 
 * @param message - Gmailメッセージオブジェクト
 * @returns ヘッダー情報
 */
export function extractMessageHeaders(message: GmailMessage): MessageHeaders {
  const headers: MessageHeaders = {};

  if (!message.payload || !message.payload.headers) {
    return headers;
  }

  for (const header of message.payload.headers) {
    if (!header.name || !header.value) {
      continue;
    }

    const name = header.name.toLowerCase();
    switch (name) {
      case 'from':
        headers.from = header.value;
        break;
      case 'to':
        headers.to = header.value;
        break;
      case 'subject':
        headers.subject = header.value;
        break;
      case 'date':
        headers.date = header.value;
        break;
      case 'message-id':
        headers.messageId = header.value;
        break;
    }
  }

  return headers;
}

/**
 * メッセージ本文を再帰的に抽出（マルチパート対応）
 * 
 * @param part - メッセージパート
 * @returns 抽出されたテキスト
 */
function extractTextFromPart(part: gmail_v1.Schema$MessagePart): string {
  let text = '';

  // このパートがテキスト本文の場合
  if (part.body?.data) {
    try {
      const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
      text += decoded;
    } catch (error) {
      // デコードエラーは無視
    }
  }

  // マルチパートの場合、再帰的に処理
  if (part.parts && part.parts.length > 0) {
    for (const subPart of part.parts) {
      const mimeType = subPart.mimeType || '';
      
      // テキスト本文を優先
      if (mimeType.startsWith('text/plain')) {
        const subText = extractTextFromPart(subPart);
        if (subText) {
          text = subText; // プレーンテキストを優先
        }
      } else if (mimeType.startsWith('text/html') && !text) {
        // HTML本文はテキストがない場合のみ使用
        const subText = extractTextFromPart(subPart);
        if (subText) {
          // HTMLタグを簡易的に削除（簡易版）
          text = subText.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        }
      } else if (!mimeType.startsWith('text/')) {
        // テキスト以外のパートはスキップ
        continue;
      } else {
        // その他のテキストパート
        const subText = extractTextFromPart(subPart);
        if (subText && !text) {
          text = subText;
        }
      }
    }
  }

  return text;
}

/**
 * メッセージ本文を抽出
 * 
 * @param message - Gmailメッセージオブジェクト
 * @returns 抽出されたテキスト本文
 */
export function extractMessageBody(message: GmailMessage): string {
  if (!message.payload) {
    return '';
  }

  return extractTextFromPart(message.payload);
}

/**
 * スレッド履歴を取得
 * 
 * @param threadId - スレッドID
 * @returns スレッド内の全メッセージ
 */
export async function getThreadHistory(threadId: string): Promise<GmailMessage[]> {
  const client = initializeGmailClient();
  if (!client) {
    throw new Error('Gmail API client is not available');
  }

  try {
    const response = await client.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

    return response.data.messages.map((msg) => ({
      id: msg.id || '',
      threadId: msg.threadId || '',
      snippet: msg.snippet || '',
      payload: msg.payload,
      internalDate: msg.internalDate,
      labelIds: msg.labelIds || []
    })) as GmailMessage[];
  } catch (error: any) {
    await handleGmailApiError(error, `getThreadHistory(${threadId})`);
    throw new Error(`Gmail API error: ${error.message}`);
  }
}

/**
 * Gmailメールを送信
 * 
 * @param to - 送信先メールアドレス
 * @param subject - 件名
 * @param body - 本文
 * @param threadId - スレッドID（返信の場合）
 * @returns 送信成功かどうか
 */
export async function sendGmailMessage(
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<boolean> {
  const client = initializeGmailClient();
  if (!client) {
    throw new Error('Gmail API client is not available');
  }

  try {
    // メール本文を作成
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\n');

    // Base64エンコード（URL-safe）
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // メール送信リクエスト
    const sendRequest: gmail_v1.Params$Resource$Users$Messages$Send = {
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId: threadId
      }
    };

    await client.users.messages.send(sendRequest);
    return true;
  } catch (error: any) {
    await handleGmailApiError(error, 'sendGmailMessage');
    throw new Error(`Gmail send error: ${error.message}`);
  }
}

/**
 * トークンの有効性を確認するための軽量なAPI呼び出し
 * 定期的に実行することで、リフレッシュトークンの6ヶ月失効を防ぐ
 * 
 * @returns 成功時true、失敗時false
 */
export async function verifyGmailToken(): Promise<boolean> {
  const client = initializeGmailClient();
  if (!client) {
    return false;
  }

  try {
    // 軽量なAPI呼び出し（プロファイル情報の取得）
    await client.users.getProfile({ userId: 'me' });
    return true;
  } catch (error: any) {
    await handleGmailApiError(error, 'verifyGmailToken');
    return false;
  }
}

