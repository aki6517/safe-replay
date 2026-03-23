ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
