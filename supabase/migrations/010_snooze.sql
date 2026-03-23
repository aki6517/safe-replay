-- スヌーズ機能: messagesテーブルにsnooze_untilカラムを追加
ALTER TABLE messages ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_messages_snooze ON messages(snooze_until) WHERE snooze_until IS NOT NULL;
