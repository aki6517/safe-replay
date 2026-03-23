-- SafeReply: Monthly counter reset cron job
-- Resets message_count_month to 0 on the 1st of each month at 00:00 UTC

SELECT cron.schedule(
  'safereply_month_reset',
  '0 0 1 * *',
  $$
    UPDATE users SET message_count_month = 0, month_reset_at = now()
    WHERE EXISTS (SELECT 1 FROM tenants WHERE tenants.id = users.tenant_id);
  $$
);

-- Monitoring query:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'safereply_month_reset';
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'safereply_month_reset') ORDER BY start_time DESC LIMIT 10;
