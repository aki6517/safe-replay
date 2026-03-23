# GitHub Secrets設定チェックリスト（Supabase移行後）

## 必須Secrets

| Secret名 | 用途 | 例 |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | `deploy.yml` でEdge Functionをデプロイ | Supabase personal access token |
| `SUPABASE_PROJECT_REF` | デプロイ先プロジェクト指定 | `abcd1234efgh5678` |

## 手動workflow用（任意）

`poll.yml` / `health.yml` を手動実行する場合のみ必要です。  
本番定期実行は Supabase Cron 側を利用します。

| Secret名 | 用途 | 例 |
|---|---|---|
| `API_BASE_URL` | API呼び出し先 | `https://<project-ref>.supabase.co/functions/v1/safereply` |
| `SERVICE_KEY` | `/poll` `/health/deep` 用認証 | `.env` の `SERVICE_KEY` と同じ値 |
| `LINE_ALLOWED_USER_IDS` | poll手動実行時の既定 `line_user_id` | `Uxxxxxxxxxxxxxxxx` |

## 設定手順

1. GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions` を開く。
2. 上記Secretsを `New repository secret` で追加する。

## 動作確認

1. `deploy.yml` 実行後、`supabase functions list` で `safereply` が更新されていることを確認。
2. 必要なら `Actions` タブから `Poll Messages` / `Health Check` を手動実行し、200応答を確認。
