-- Enable RLS on slack_installations (missing from 005)

ALTER TABLE slack_installations ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (app accesses via service_role key)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'slack_installations'
        AND policyname = 'Service role full access on slack_installations'
    ) THEN
        CREATE POLICY "Service role full access on slack_installations"
            ON slack_installations
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;
