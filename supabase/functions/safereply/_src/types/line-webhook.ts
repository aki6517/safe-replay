/**
 * LINE Webhook イベント型定義
 */

// LINE Webhook リクエストボディ
export interface LineWebhookRequest {
  destination: string;
  events: LineWebhookEvent[];
}

// LINE Webhook イベント（共通部分）
export interface LineWebhookEvent {
  type: 'message' | 'postback' | 'follow' | 'unfollow' | 'join' | 'leave' | 'memberJoined' | 'memberLeft' | 'accountLink' | 'things';
  timestamp: number;
  source: LineEventSource;
  replyToken?: string;
  mode?: 'active' | 'standby';
}

// LINE イベントソース
export interface LineEventSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

// メッセージイベント
export interface MessageEvent extends LineWebhookEvent {
  type: 'message';
  message: LineMessage;
}

// LINE メッセージ
export interface LineMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  text?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  packageId?: string;
  stickerId?: string;
}

// ポストバックイベント
export interface PostbackEvent extends LineWebhookEvent {
  type: 'postback';
  postback: {
    data: string;
    params?: {
      date?: string;
      time?: string;
      datetime?: string;
    };
  };
}

// フォローイベント
export interface FollowEvent extends LineWebhookEvent {
  type: 'follow';
}

// アンフォローイベント
export interface UnfollowEvent extends LineWebhookEvent {
  type: 'unfollow';
}


