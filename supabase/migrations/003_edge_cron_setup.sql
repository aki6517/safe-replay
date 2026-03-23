-- SafeReply: Supabase Edge Functions + Cron integration
-- Requires paid Supabase plan for stable always-on operation.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE SCHEMA IF NOT EXISTS private;

-- Vault Secret names expected:
-- - project_url   : e.g. https://<project-ref>.supabase.co
-- - service_key   : SERVICE_KEY used by SafeReply internal auth
-- - line_user_id  : default LINE user id for polling payload (optional)
--
-- Example registration (run in SQL editor with real values):
-- SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url', 'SafeReply project URL');
-- SELECT vault.create_secret('your-service-key', 'service_key', 'SafeReply service auth key');
-- SELECT vault.create_secret('Uxxxxxxxxxxxxxxxx', 'line_user_id', 'Default LINE user id');

CREATE OR REPLACE FUNCTION private.get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret
  INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;

  IF secret_value IS NULL OR secret_value = '' THEN
    RAISE EXCEPTION 'Vault secret "%" is not configured', secret_name;
  END IF;

  RETURN secret_value;
END;
$$;

CREATE OR REPLACE FUNCTION private.safereply_poll_body()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  line_user text;
BEGIN
  BEGIN
    line_user := private.get_secret('line_user_id');
  EXCEPTION
    WHEN OTHERS THEN
      line_user := NULL;
  END;

  IF line_user IS NULL OR line_user = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object('line_user_id', line_user);
END;
$$;

CREATE OR REPLACE FUNCTION private.safereply_auth_headers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'Authorization', 'Bearer ' || private.get_secret('service_key'),
    'Content-Type', 'application/json'
  );
$$;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'safereply_poll_gmail',
      'safereply_poll_chatwork',
      'safereply_health_deep'
    )
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'safereply_poll_gmail',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := private.get_secret('project_url') || '/functions/v1/safereply/api/v1/poll/gmail',
      headers := private.safereply_auth_headers(),
      body := private.safereply_poll_body()
    );
  $$
);

SELECT cron.schedule(
  'safereply_poll_chatwork',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := private.get_secret('project_url') || '/functions/v1/safereply/api/v1/poll/chatwork',
      headers := private.safereply_auth_headers(),
      body := private.safereply_poll_body()
    );
  $$
);

SELECT cron.schedule(
  'safereply_health_deep',
  '*/15 * * * *',
  $$
    SELECT net.http_get(
      url := private.get_secret('project_url') || '/functions/v1/safereply/api/v1/health/deep',
      headers := private.safereply_auth_headers()
    );
  $$
);

-- Monitoring queries:
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
-- SELECT jobid, status, start_time, end_time, return_message
-- FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'safereply_%')
-- ORDER BY start_time DESC
-- LIMIT 100;
