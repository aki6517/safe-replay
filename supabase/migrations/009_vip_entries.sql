-- VIPリスト: 重要な送信者を登録し、AIトリアージに関わらず常にType A通知する

CREATE TABLE IF NOT EXISTS vip_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_identifier TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, sender_identifier)
);

ALTER TABLE vip_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on vip_entries"
    ON vip_entries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_vip_entries_user_id ON vip_entries(user_id);

COMMENT ON TABLE vip_entries IS 'VIP送信者リスト: 常にType A（要返信）として通知される送信者';
COMMENT ON COLUMN vip_entries.sender_identifier IS 'メールアドレスまたはドメイン（部分一致で判定）';
COMMENT ON COLUMN vip_entries.label IS 'ユーザーが設定する表示名（任意）';
