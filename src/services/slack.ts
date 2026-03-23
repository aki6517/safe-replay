import type {
  SlackAppMentionEvent,
  SlackEventEnvelope,
  SlackIncomingEvent,
  SlackMessageEvent,
  SlackOAuthAccessResponse,
  SlackOAuthStatePayload,
  SlackPostMessageResponse,
  SlackUsersInfoResponse
} from '../types/slack';

const SLACK_API_BASE = 'https://slack.com/api';
const BOT_SCOPES = ['app_mentions:read', 'im:history', 'chat:write', 'users:read'];
const USER_SCOPES = ['chat:write'];
const SLACK_SIGNATURE_VERSION = 'v0';
const SLACK_TIMESTAMP_TTL_SECONDS = 60 * 5;

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isSlackAppMentionEvent(event: SlackIncomingEvent): event is SlackAppMentionEvent {
  return (
    event.type === 'app_mention' &&
    isString((event as Record<string, unknown>).user) &&
    isString((event as Record<string, unknown>).channel) &&
    isString((event as Record<string, unknown>).ts)
  );
}

export function isSlackMessageEvent(event: SlackIncomingEvent): event is SlackMessageEvent {
  return (
    event.type === 'message' &&
    isString((event as Record<string, unknown>).channel) &&
    isString((event as Record<string, unknown>).ts)
  );
}

function getSlackStateSecret(): string {
  return process.env.SLACK_STATE_SECRET || process.env.SLACK_SIGNING_SECRET || process.env.SERVICE_KEY || '';
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signHmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toHex(signature);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function slackApiRequest<T extends { ok?: boolean; error?: string }>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${SLACK_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Slack API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = (await response.json()) as T;
  if (data.ok === false) {
    throw new Error(`Slack API error: ${data.error || 'unknown_error'}`);
  }

  return data;
}

export function isSlackOAuthConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_SIGNING_SECRET &&
    getSlackStateSecret()
  );
}

export function getSlackScopes(): { botScopes: string[]; userScopes: string[] } {
  return {
    botScopes: [...BOT_SCOPES],
    userScopes: [...USER_SCOPES]
  };
}

export async function createSlackOAuthState(lineUserId: string): Promise<string> {
  const secret = getSlackStateSecret();
  if (!secret) {
    throw new Error('Slack state secret not configured');
  }

  const payload: SlackOAuthStatePayload = {
    lineUserId,
    issuedAt: Date.now(),
    nonce: crypto.randomUUID()
  };
  const serializedPayload = JSON.stringify(payload);
  const signature = await signHmacSha256(secret, serializedPayload);
  return `${encodeURIComponent(serializedPayload)}.${signature}`;
}

export async function parseSlackOAuthState(state: string): Promise<SlackOAuthStatePayload> {
  const secret = getSlackStateSecret();
  if (!secret) {
    throw new Error('Slack state secret not configured');
  }

  const separatorIndex = state.lastIndexOf('.');
  if (separatorIndex <= 0) {
    throw new Error('Invalid Slack OAuth state');
  }

  const encodedPayload = state.slice(0, separatorIndex);
  const providedSignature = state.slice(separatorIndex + 1);
  const serializedPayload = decodeURIComponent(encodedPayload);
  const expectedSignature = await signHmacSha256(secret, serializedPayload);

  if (!safeEqual(expectedSignature, providedSignature)) {
    throw new Error('Slack OAuth state signature mismatch');
  }

  const payload = JSON.parse(serializedPayload) as SlackOAuthStatePayload;
  if (!payload.lineUserId || !payload.issuedAt || !payload.nonce) {
    throw new Error('Slack OAuth state payload is incomplete');
  }

  const ageMs = Date.now() - payload.issuedAt;
  if (ageMs < 0 || ageMs > SLACK_TIMESTAMP_TTL_SECONDS * 1000) {
    throw new Error('Slack OAuth state expired');
  }

  return payload;
}

export function buildSlackAuthorizeUrl(redirectUri: string, state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  if (!clientId) {
    throw new Error('Slack client ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: BOT_SCOPES.join(','),
    user_scope: USER_SCOPES.join(','),
    state
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCodeForTokens(
  code: string,
  redirectUri: string
): Promise<SlackOAuthAccessResponse> {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const clientSecret = process.env.SLACK_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw new Error('Slack OAuth credentials not configured');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });

  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Slack OAuth exchange failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as SlackOAuthAccessResponse;
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error || 'unknown_error'}`);
  }

  return data;
}

export async function verifySlackRequestSignature(
  rawBody: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET || '';
  if (!signingSecret || !timestamp || !signature) {
    return false;
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  if (Math.abs(Date.now() / 1000 - timestampNumber) > SLACK_TIMESTAMP_TTL_SECONDS) {
    return false;
  }

  const baseString = `${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  const computed = `${SLACK_SIGNATURE_VERSION}=${await signHmacSha256(signingSecret, baseString)}`;
  return safeEqual(computed, signature);
}

export function shouldProcessSlackEvent(event: SlackIncomingEvent): boolean {
  if (isSlackAppMentionEvent(event)) {
    return Boolean(event.user && event.channel && event.ts);
  }

  if (isSlackMessageEvent(event)) {
    if (event.subtype || event.bot_id) {
      return false;
    }

    return event.channel_type === 'im' && Boolean(event.user && event.channel && event.ts);
  }

  return false;
}

export function getSlackEventTeamId(payload: SlackEventEnvelope): string | null {
  return payload.team_id || payload.authorizations?.[0]?.team_id || null;
}

export function getSlackInstallationUserId(payload: SlackEventEnvelope): string | null {
  const authorizedUserId = payload.authorizations?.find((authorization) =>
    typeof authorization.user_id === 'string' && authorization.user_id.length > 0
  )?.user_id;

  if (authorizedUserId) {
    return authorizedUserId;
  }

  return payload.event ? getSlackEventUserId(payload.event) : null;
}

export function getSlackEventUserId(event: SlackIncomingEvent): string | null {
  if (isSlackAppMentionEvent(event)) {
    return event.user || null;
  }

  if (isSlackMessageEvent(event) && typeof event.user === 'string') {
    return event.user;
  }

  return null;
}

export function normalizeSlackMessageText(
  text: string,
  options?: {
    botUserId?: string;
  }
): string {
  let normalized = text || '';

  if (options?.botUserId) {
    const botMentionPattern = new RegExp(`<@${options.botUserId}>`, 'g');
    normalized = normalized.replace(botMentionPattern, '');
  }

  normalized = normalized.replace(/<@([A-Z0-9]+)>/g, '@$1');
  normalized = normalized.replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2');
  normalized = normalized.replace(/<mailto:([^|>]+)\|([^>]+)>/g, '$2');
  normalized = normalized.replace(/<([^|>]+)\|([^>]+)>/g, '$2 ($1)');
  normalized = normalized.replace(/<([^>]+)>/g, '$1');
  normalized = normalized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
    .replace(/\n{3,}/g, '\n\n');

  return normalized;
}

export async function getSlackUserDisplayName(
  token: string,
  userId: string
): Promise<string | null> {
  const response = await slackApiRequest<SlackUsersInfoResponse>('/users.info?user=' + encodeURIComponent(userId), token, {
    method: 'GET',
    headers: {}
  });

  const profile = response.user?.profile;
  return (
    profile?.display_name ||
    profile?.display_name_normalized ||
    profile?.real_name ||
    profile?.real_name_normalized ||
    response.user?.name ||
    response.user?.id ||
    null
  );
}

export async function sendSlackMessage(
  token: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<SlackPostMessageResponse> {
  return slackApiRequest<SlackPostMessageResponse>('/chat.postMessage', token, {
    method: 'POST',
    body: JSON.stringify({
      channel,
      text,
      ...(threadTs ? { thread_ts: threadTs } : {})
    })
  });
}
