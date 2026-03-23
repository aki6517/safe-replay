# Supabase Edge Functions 移行Runbook

## 1. 事前準備

1. Supabaseを有料プランで運用する。
2. `.env` の `BASE_URL` を `https://<project-ref>.supabase.co/functions/v1/safereply` に設定する。
3. `SERVICE_KEY` を安全な値に更新する。

## 2. Edge Functionデプロイ

```bash
supabase functions deploy safereply --project-ref <project-ref> --no-verify-jwt
```

## 3. Vault Secret設定（SQL Editor）

```sql
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url', 'SafeReply project URL');
SELECT vault.create_secret('<SERVICE_KEY>', 'service_key', 'SafeReply service key');
SELECT vault.create_secret('<LINE_USER_ID>', 'line_user_id', 'default line user id');
```

すでに存在する場合は、既存Secretを更新してください。

## 4. Cron有効化確認

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'safereply_%'
ORDER BY jobname;
```

```sql
SELECT jobid, status, start_time, end_time, return_message
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'safereply_%')
ORDER BY start_time DESC
LIMIT 100;
```

## 5. 外部サービス切替

1. LINE Developers の Webhook URL を  
   `https://<project-ref>.supabase.co/functions/v1/safereply/api/v1/line/webhook` へ変更。
2. Google OAuth Redirect URI を  
   `https://<project-ref>.supabase.co/functions/v1/safereply/api/oauth/gmail/callback` へ変更。
3. 監視・手動実行用URL（必要なら `API_BASE_URL`）を新URLへ更新。

## 6. 受け入れ確認

1. `GET /api/v1/health` が200。
2. `GET /api/v1/health/deep` が200かつ `database=healthy`。
3. LINE Webhook署名検証とイベント処理が通る。
4. Gmail OAuth callbackでrefresh token保存が通る。
5. poll Gmail/Chatworkが成功し、LINE通知(Type A/B)が届く。
