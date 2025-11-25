-- SafeReply 初期スキーマ
-- 設計書に基づくデータベース定義

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- USERS
-- ========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id TEXT NOT NULL UNIQUE,
    display_name TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_line_user_id ON users(line_user_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ========================================
-- API_CREDENTIALS
-- ========================================
CREATE TABLE api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('gmail', 'chatwork', 'openai')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, service_type)
);

CREATE INDEX idx_api_credentials_expires ON api_credentials(token_expires_at);

-- ========================================
-- USER_SETTINGS
-- ========================================
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, setting_key)
);

-- ========================================
-- WHITELIST_ENTRIES
-- ========================================
CREATE TABLE whitelist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allowed_line_id TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, allowed_line_id)
);

-- ========================================
-- BLACKLIST_ENTRIES (Ver 1.1用)
-- ========================================
CREATE TABLE blacklist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_identifier TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('gmail', 'chatwork', 'line')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, sender_identifier, source_type)
);

-- ========================================
-- MESSAGES
-- ========================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('gmail', 'chatwork', 'line_forward')),
    source_message_id TEXT NOT NULL,
    thread_id TEXT,
    sender_identifier TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT,
    body_plain TEXT,
    body_html TEXT,
    extracted_content TEXT,
    triage_type TEXT CHECK (triage_type IN ('A', 'B', 'C')),
    triage_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'sent', 'dismissed', 'read', 'snoozed')),
    priority_score INTEGER CHECK (priority_score >= 0 AND priority_score <= 100),
    ai_analysis JSONB,
    metadata JSONB DEFAULT '{}',
    received_at TIMESTAMPTZ NOT NULL,
    notified_at TIMESTAMPTZ,
    actioned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, source_type, source_message_id)
);

CREATE INDEX idx_messages_user_status ON messages(user_id, status);
CREATE INDEX idx_messages_user_triage ON messages(user_id, triage_type);
CREATE INDEX idx_messages_source ON messages(source_type, source_message_id);
CREATE INDEX idx_messages_received_at ON messages(received_at DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id);

-- ========================================
-- MESSAGE_DRAFTS
-- ========================================
CREATE TABLE message_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    draft_content TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'formal' CHECK (tone IN ('formal', 'casual', 'brief')),
    version INTEGER NOT NULL DEFAULT 1,
    is_selected BOOLEAN NOT NULL DEFAULT false,
    is_sent BOOLEAN NOT NULL DEFAULT false,
    sent_via TEXT CHECK (sent_via IN ('gmail', 'chatwork')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drafts_message ON message_drafts(message_id);
CREATE INDEX idx_drafts_is_sent ON message_drafts(is_sent);

-- ========================================
-- MESSAGE_ATTACHMENTS
-- ========================================
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes <= 10485760),
    storage_path TEXT,
    storage_url TEXT,
    is_parsed BOOLEAN NOT NULL DEFAULT false,
    parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'processing', 'success', 'failed', 'skipped')),
    parse_error TEXT,
    extracted_text TEXT,
    parse_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_message ON message_attachments(message_id);
CREATE INDEX idx_attachments_parse_status ON message_attachments(parse_status);

-- ========================================
-- MESSAGE_ACTIONS
-- ========================================
CREATE TABLE message_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('view', 'send', 'edit', 'dismiss', 'snooze', 'reopen', 'forward')),
    action_data JSONB,
    triggered_by TEXT NOT NULL DEFAULT 'user' CHECK (triggered_by IN ('user', 'system', 'schedule')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_actions_message ON message_actions(message_id);
CREATE INDEX idx_actions_created_at ON message_actions(created_at DESC);

-- ========================================
-- UPDATED_AT TRIGGER
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON api_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================
-- RLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_actions ENABLE ROW LEVEL SECURITY;

-- サービスロール用ポリシー（バックエンドからの全アクセス許可）
CREATE POLICY "Service role has full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON api_credentials
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON user_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON whitelist_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON blacklist_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON message_drafts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON message_attachments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access" ON message_actions
  FOR ALL USING (auth.role() = 'service_role');

