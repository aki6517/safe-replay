export interface SlackOAuthStatePayload {
  lineUserId: string;
  issuedAt: number;
  nonce: string;
}

export interface SlackOAuthAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  refresh_token?: string;
  expires_in?: number;
  team?: {
    id: string;
    name?: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export interface SlackUsersInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    name?: string;
    profile?: {
      real_name?: string;
      display_name?: string;
      real_name_normalized?: string;
      display_name_normalized?: string;
    };
  };
}

export interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
  channel?: string;
  ts?: string;
}

export interface SlackAuthorization {
  team_id?: string;
  user_id?: string;
  is_bot?: boolean;
  is_enterprise_install?: boolean;
}

export interface SlackMessageEvent {
  type: 'message';
  channel: string;
  channel_type?: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}

export interface SlackAppMentionEvent {
  type: 'app_mention';
  channel: string;
  user: string;
  text?: string;
  ts: string;
  thread_ts?: string;
}

export type SlackIncomingEvent =
  | SlackMessageEvent
  | SlackAppMentionEvent
  | {
      type: string;
      [key: string]: unknown;
    };

export interface SlackEventEnvelope {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  type: string;
  challenge?: string;
  event_id?: string;
  event_time?: number;
  authorizations?: SlackAuthorization[];
  event?: SlackIncomingEvent;
}
