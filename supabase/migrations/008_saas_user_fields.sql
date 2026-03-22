-- SaaS user fields for plan management

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS message_count_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS month_reset_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN users.plan_type IS 'Subscription plan: free, pro, enterprise';
COMMENT ON COLUMN users.message_count_month IS 'Messages processed in current billing month';
COMMENT ON COLUMN users.month_reset_at IS 'When the monthly counter was last reset';
