-- マルチユーザー対応のためのスキーマ拡張
-- 各ユーザーのGmail/Chatwork認証情報を保存

-- usersテーブルにカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chatwork_api_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chatwork_room_ids TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- statusの値を制約
-- pending: セットアップ未完了
-- active: 利用中
-- suspended: 一時停止
-- deleted: 削除済み

-- インデックス追加（検索高速化）
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_gmail_email ON users(gmail_email);

-- コメント追加
COMMENT ON COLUMN users.gmail_refresh_token IS 'Gmail API refresh token';
COMMENT ON COLUMN users.gmail_access_token IS 'Gmail API access token (短期)';
COMMENT ON COLUMN users.gmail_token_expires_at IS 'Access tokenの有効期限';
COMMENT ON COLUMN users.gmail_email IS '連携したGmailアドレス';
COMMENT ON COLUMN users.chatwork_api_token IS 'Chatwork API token';
COMMENT ON COLUMN users.chatwork_room_ids IS '監視するChatworkルームIDの配列';
COMMENT ON COLUMN users.status IS 'ユーザーステータス: pending/active/suspended/deleted';
COMMENT ON COLUMN users.activated_at IS 'アクティベート日時';

