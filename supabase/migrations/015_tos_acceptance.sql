-- 015_tos_acceptance.sql
-- 利用規約・プライバシーポリシー同意日時を記録するカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
