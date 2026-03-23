/**
 * Gmail API サービス
 *
 * - Gmail REST API で実装（Node / Edge共通）
 * - Node / Deno 両対応の base64 処理を実装
 */
import { notifyApiTokenExpired } from '../utils/emergency-notification.ts';

type GmailListMessagesParams = {
  userId: string;
  maxResults?: number;
  q?: string;
};

type GmailGetMessageParams = {
  userId: string;
  id: string;
  format?: string;
};

type GmailGetThreadParams = {
  userId: string;
  id: string;
  format?: string;
};

type GmailSendMessageParams = {
  userId: string;
  requestBody: {
    raw: string;
    threadId?: string;
  };
};

type GmailListMessagesResponse = {
  data: {
    messages?: Array<{ id?: string }>;
  };
};

type GmailGetMessageResponse = {
  data: GmailApiMessage;
};

type GmailGetThreadResponse = {
  data: {
    messages?: GmailApiMessage[];
  };
};

type GmailGetProfileResponse = {
  data: {
    emailAddress?: string;
  };
};

export interface GmailClient {
  users: {
    messages: {
      list(params: GmailListMessagesParams): Promise<GmailListMessagesResponse>;
      get(params: GmailGetMessageParams): Promise<GmailGetMessageResponse>;
      send(params: GmailSendMessageParams): Promise<unknown>;
    };
    threads: {
      get(params: GmailGetThreadParams): Promise<GmailGetThreadResponse>;
    };
    getProfile(params: { userId: string }): Promise<GmailGetProfileResponse>;
  };
}

type GmailClientConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export interface GmailMessagePartHeader {
  name?: string;
  value?: string;
}

export interface GmailMessagePartBody {
  attachmentId?: string;
  size?: number;
  data?: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailMessagePartHeader[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

interface GmailApiMessage {
  id?: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailMessagePart;
  internalDate?: string;
  labelIds?: string[];
}

// Gmail APIクライアントのシングルトンインスタンス
let gmailClient: GmailClient | null = null;

function decodeBase64ToUtf8(base64Input: string): string {
  const normalized = base64Input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bufferCtor = (globalThis as { Buffer?: typeof Buffer }).Buffer;

  if (bufferCtor) {
    return bufferCtor.from(padded, 'base64').toString('utf-8');
  }

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  return '';
}

function encodeUtf8ToBase64Url(value: string): string {
  const bufferCtor = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  let base64: string;

  if (bufferCtor) {
    base64 = bufferCtor.from(value, 'utf-8').toString('base64');
  } else if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    base64 = btoa(binary);
  } else {
    throw new Error('No base64 encoder available');
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function requestAccessToken(config: GmailClientConfig): Promise<{
  accessToken: string;
  expiresInSeconds?: number;
}> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Failed to refresh access token: ${response.status} ${errorBody}`);
  }

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!json.access_token) {
    throw new Error('Access token not found in OAuth response');
  }

  return {
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in
  };
}

function createRestGmailClient(config: GmailClientConfig): GmailClient {
  let accessToken = '';
  let accessTokenExpiresAt = 0;

  async function getAccessToken(): Promise<string> {
    const now = Date.now();
    if (accessToken && accessTokenExpiresAt > now + 60_000) {
      return accessToken;
    }

    const token = await requestAccessToken(config);
    accessToken = token.accessToken;
    accessTokenExpiresAt = now + (token.expiresInSeconds ?? 3600) * 1000;
    return accessToken;
  }

  async function gmailFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getAccessToken();
    const headers = new Headers(init?.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);

    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Gmail REST API error: ${response.status} ${response.statusText} ${errorBody}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  return {
    users: {
      messages: {
        list: async (params) => {
          const q = new URLSearchParams();
          if (params.maxResults) {
            q.set('maxResults', String(params.maxResults));
          }
          if (params.q) {
            q.set('q', params.q);
          }
          const query = q.toString();
          const data = await gmailFetch<GmailListMessagesResponse['data']>(
            `/users/${encodeURIComponent(params.userId)}/messages${query ? `?${query}` : ''}`
          );
          return { data };
        },
        get: async (params) => {
          const q = new URLSearchParams();
          if (params.format) {
            q.set('format', params.format);
          }
          const query = q.toString();
          const data = await gmailFetch<GmailApiMessage>(
            `/users/${encodeURIComponent(params.userId)}/messages/${encodeURIComponent(params.id)}${query ? `?${query}` : ''}`
          );
          return { data };
        },
        send: async (params) => {
          const data = await gmailFetch<Record<string, unknown>>(
            `/users/${encodeURIComponent(params.userId)}/messages/send`,
            {
              method: 'POST',
              body: JSON.stringify(params.requestBody)
            }
          );
          return { data };
        }
      },
      threads: {
        get: async (params) => {
          const q = new URLSearchParams();
          if (params.format) {
            q.set('format', params.format);
          }
          const query = q.toString();
          const data = await gmailFetch<GmailGetThreadResponse['data']>(
            `/users/${encodeURIComponent(params.userId)}/threads/${encodeURIComponent(params.id)}${query ? `?${query}` : ''}`
          );
          return { data };
        }
      },
      getProfile: async (params) => {
        const data = await gmailFetch<GmailGetProfileResponse['data']>(
          `/users/${encodeURIComponent(params.userId)}/profile`
        );
        return { data };
      }
    }
  };
}

/**
 * リフレッシュトークン失効エラーかどうかを判定
 */
function isTokenExpiredError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message || error.toString();
  const errorCode = error.code;

  const expiredPatterns = [
    'invalid_grant',
    'Token has been expired',
    'Token has been revoked',
    'invalid_token',
    'unauthorized_client',
    'access_denied'
  ];

  return expiredPatterns.some(
    (pattern) =>
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

    const clientId = process.env.GMAIL_CLIENT_ID;
    let authUrl: string | undefined;

    if (clientId) {
      try {
        const redirectUri = encodeURIComponent(process.env.BASE_URL
          ? `${process.env.BASE_URL.replace(/\/+$/, '')}/api/oauth/gmail/callback`
          : 'urn:ietf:wg:oauth:2.0:oob');
        const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send');
        authUrl =
          'https://accounts.google.com/o/oauth2/v2/auth?' +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${redirectUri}&` +
          'response_type=code&' +
          `scope=${scope}&` +
          'access_type=offline&' +
          'prompt=consent';
      } catch (urlError) {
        console.error('[Gmail API] 認証URL生成エラー:', urlError);
      }
    }

    await notifyApiTokenExpired(
      'Gmail',
      error.message || 'Token has been expired or revoked.',
      authUrl
    );

    gmailClient = null;
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
function initializeGmailClient(): GmailClient | null {
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
    gmailClient = createRestGmailClient({
      clientId,
      clientSecret,
      refreshToken
    });
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
 * ユーザー情報の型定義（マルチユーザー対応）
 */
export interface GmailUserCredentials {
  userId: string;
  lineUserId: string;
  gmailRefreshToken: string;
  gmailEmail?: string;
}

/**
 * ユーザー固有のGmail APIクライアントを作成（マルチユーザー対応）
 */
export function createGmailClientForUser(credentials: GmailUserCredentials): GmailClient | null {
  const clientId = process.env.GMAIL_WEB_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_WEB_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret || !credentials.gmailRefreshToken) {
    console.error('[createGmailClientForUser] 認証情報が不足しています', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!credentials.gmailRefreshToken,
      userId: credentials.userId
    });
    return null;
  }

  try {
    const userGmailClient = createRestGmailClient({
      clientId,
      clientSecret,
      refreshToken: credentials.gmailRefreshToken
    });

    console.log('[createGmailClientForUser] クライアント作成成功', {
      userId: credentials.userId,
      gmailEmail: credentials.gmailEmail
    });

    return userGmailClient;
  } catch (error: any) {
    console.error('[createGmailClientForUser] クライアント作成失敗', {
      userId: credentials.userId,
      error: error.message
    });
    return null;
  }
}

/**
 * ユーザー固有のGmailクライアントで未読メッセージを取得
 */
export async function getUnreadMessagesForUser(
  client: GmailClient,
  maxResults: number = 50,
  daysBack: number = 3
): Promise<GmailMessage[]> {
  try {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    const afterDate = date.toISOString().split('T')[0].replace(/-/g, '/');
    const query = `is:unread in:inbox after:${afterDate} -in:spam -in:trash`;

    const listResponse = await client.users.messages.list({
      userId: 'me',
      maxResults,
      q: query
    });

    const messages = listResponse.data.messages || [];
    const fullMessages: GmailMessage[] = [];

    for (const msg of messages) {
      if (!msg.id) {
        continue;
      }

      try {
        const fullMessage = await client.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        if (fullMessage.data) {
          fullMessages.push({
            id: fullMessage.data.id || msg.id,
            threadId: fullMessage.data.threadId || '',
            snippet: fullMessage.data.snippet || '',
            payload: fullMessage.data.payload,
            internalDate: fullMessage.data.internalDate || undefined,
            labelIds: fullMessage.data.labelIds || undefined
          });
        }
      } catch (error: any) {
        console.warn(`Failed to fetch message ${msg.id}:`, error.message);
      }
    }

    return fullMessages;
  } catch (error: any) {
    console.error('[getUnreadMessagesForUser] エラー:', error.message);
    throw error;
  }
}

/**
 * メッセージの型定義
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: GmailMessagePart;
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
 */
export async function getUnreadMessages(maxResults: number = 50, daysBack: number = 3): Promise<GmailMessage[]> {
  const client = initializeGmailClient();
  if (!client) {
    throw new Error('Gmail API client is not available');
  }

  try {
    const now = Date.now();
    const daysAgo = new Date(now - daysBack * 24 * 60 * 60 * 1000);
    const daysAgoUnixSeconds = Math.floor(daysAgo.getTime() / 1000);
    const query = `after:${daysAgoUnixSeconds} -in:spam -in:trash -is:deleted`;

    const response = await client.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 500)
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

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
 */
function extractTextFromPart(part: GmailMessagePart): string {
  let text = '';

  if (part.body?.data) {
    try {
      text += decodeBase64ToUtf8(part.body.data);
    } catch {
      // ignore
    }
  }

  if (part.parts && part.parts.length > 0) {
    for (const subPart of part.parts) {
      const mimeType = subPart.mimeType || '';

      if (mimeType.startsWith('text/plain')) {
        const subText = extractTextFromPart(subPart);
        if (subText) {
          text = subText;
        }
      } else if (mimeType.startsWith('text/html') && !text) {
        const subText = extractTextFromPart(subPart);
        if (subText) {
          text = subText.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        }
      } else if (!mimeType.startsWith('text/')) {
        continue;
      } else {
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
 */
export function extractMessageBody(message: GmailMessage): string {
  if (!message.payload) {
    return '';
  }

  return extractTextFromPart(message.payload);
}

/**
 * スレッド履歴を取得
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
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\n');

    const encodedEmail = encodeUtf8ToBase64Url(email);

    const sendRequest: GmailSendMessageParams = {
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId
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
 */
export async function verifyGmailToken(): Promise<boolean> {
  const client = initializeGmailClient();
  if (!client) {
    return false;
  }

  try {
    await client.users.getProfile({ userId: 'me' });
    return true;
  } catch (error: any) {
    await handleGmailApiError(error, 'verifyGmailToken');
    return false;
  }
}
