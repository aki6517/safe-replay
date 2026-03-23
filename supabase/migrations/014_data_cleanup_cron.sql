-- SafeReply: Automated data cleanup cron job
-- Runs daily at 03:00 UTC to remove old messages, actions, and logs

SELECT cron.schedule(
  'safereply_data_cleanup',
  '0 3 * * *',
  $$
    -- Delete messages older than 90 days (cascades to message_drafts and message_attachments)
    DELETE FROM messages
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND EXISTS (SELECT 1 FROM tenants WHERE tenants.id = messages.tenant_id);

    -- Delete message actions older than 1 year
    DELETE FROM message_actions
    WHERE created_at < NOW() - INTERVAL '1 year'
      AND EXISTS (SELECT 1 FROM tenants WHERE tenants.id = message_actions.tenant_id);

    -- Delete usage logs older than 1 year
    DELETE FROM usage_logs
    WHERE created_at < NOW() - INTERVAL '1 year'
      AND EXISTS (SELECT 1 FROM tenants WHERE tenants.id = usage_logs.tenant_id);
  $$
);

-- Monitoring queries:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'safereply_data_cleanup';
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'safereply_data_cleanup') ORDER BY start_time DESC LIMIT 10;
