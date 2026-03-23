-- 011_reply_templates.sql
-- 返信テンプレート機能（F-12）
-- Freeプランは3件まで、Proプランは無制限

CREATE TABLE IF NOT EXISTS reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on reply_templates"
    ON reply_templates FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_reply_templates_user_id ON reply_templates(user_id);
