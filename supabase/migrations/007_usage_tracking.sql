-- Usage tracking for SaaS billing

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    operation TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on usage_logs"
    ON usage_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id
    ON usage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created
    ON usage_logs(user_id, created_at);

COMMENT ON TABLE usage_logs IS 'Per-user API usage tracking for billing and rate limiting';
