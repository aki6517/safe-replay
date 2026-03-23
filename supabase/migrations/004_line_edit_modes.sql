-- SafeReply: persist LINE custom-edit mode across Edge invocations
-- Redis未設定環境でもカスタム修正フローを維持するための状態テーブル

CREATE TABLE IF NOT EXISTS line_edit_modes (
  line_user_id TEXT PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  current_draft TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_line_edit_modes_expires_at
  ON line_edit_modes(expires_at);

ALTER TABLE line_edit_modes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'line_edit_modes'
      AND policyname = 'Service role has full access'
  ) THEN
    CREATE POLICY "Service role has full access" ON line_edit_modes
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
