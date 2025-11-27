### 背景 / 目的

CI/CDと定期実行のためのGitHub Actionsワークフローを作成し、自動化の基盤を整える。

- 依存: #6
- ラベル: `infra`, `ci`

### スコープ / 作業項目

- 自動デプロイワークフローの作成
- ポーリングワークフローの作成（スケルトン）
- ヘルスチェックワークフローの作成（スケルトン）
- GitHub Secretsの設定

### ゴール / 完了条件（Acceptance Criteria）

- [x] `.github/workflows/deploy.yml`を作成（CIワークフロー）
- [x] `.github/workflows/poll.yml`を作成（5分間隔ポーリング、スケルトン）
- [x] `.github/workflows/health.yml`を作成（15分間隔ヘルスチェック、スケルトン）
- [x] GitHub Secretsに必要な値を設定（`API_BASE_URL`、`SERVICE_KEY`）
- [x] ワークフローが正常に実行される

### 実装内容

#### 作成したワークフローファイル

1. **`.github/workflows/deploy.yml`** - CIワークフロー
   - `main`ブランチへのpush時に自動実行
   - 手動実行も可能（`workflow_dispatch`）
   - 型チェック、Lint、ビルドを実行
   - デプロイはRailwayの自動デプロイ機能を使用（GitHub連携）

2. **`.github/workflows/poll.yml`** - ポーリングワークフロー（既存）
   - 5分間隔でGmail/Chatworkのポーリングを実行
   - 手動実行も可能

3. **`.github/workflows/health.yml`** - ヘルスチェックワークフロー（既存）
   - 15分間隔でヘルスチェックを実行
   - エラー時にアラートを送信

### GitHub Secrets設定手順

以下のSecretsをGitHubリポジトリに設定する必要があります：

1. **GitHubリポジトリの設定画面に移動**
   - `Settings` → `Secrets and variables` → `Actions`

2. **以下のSecretsを追加**

   | Secret名 | 説明 | 取得方法 |
   |---------|------|---------|
   | `RAILWAY_TOKEN` | Railway APIトークン | Railwayダッシュボード → Account Settings → Tokens |
   | `RAILWAY_SERVICE_NAME` | Railwayサービス名 | Railwayプロジェクトのサービス名（通常はプロジェクト名） |
   | `API_BASE_URL` | デプロイされたAPIのベースURL | Railwayデプロイ後のURL（例: `https://your-app.railway.app`） |
   | `SERVICE_KEY` | ヘルスチェック・ポーリング用の認証キー | `.env`ファイルの`SERVICE_KEY`と同じ値 |

3. **Railwayトークンの取得方法**
   - Railwayダッシュボードにログイン
   - 右上のアカウントメニュー → `Account Settings`
   - `Tokens`タブ → `New Token`をクリック
   - トークン名を入力して作成
   - 作成されたトークンをコピーしてGitHub Secretsに設定

4. **Railwayサービス名の確認方法**
   - Railwayプロジェクトのダッシュボードを開く
   - サービス名を確認（通常はプロジェクト名と同じ）

### テスト観点

- CI/CD: GitHub Actionsでワークフローが実行されることを確認
- 検証方法: ワークフローが正常に実行され、エラーなく完了することを確認
- デプロイ確認: `main`ブランチにpushして、Railwayへの自動デプロイが正常に完了することを確認

### 完了日

2025-11-27

### 完了時の状況

- ✅ CIワークフロー: 正常に動作（型チェック、Lint、ビルドが成功）
- ✅ Poll Messagesワークフロー: 正常に動作（5分間隔で自動実行）
- ✅ Health Checkワークフロー: 正常に動作（15分間隔で自動実行）
- ✅ GitHub Secrets設定完了: `API_BASE_URL`、`SERVICE_KEY`を設定
- ✅ Railway自動デプロイ: GitHub連携で正常に動作
- ✅ アプリケーションURL: `https://safe-replay-production.up.railway.app`

### 追加で作成したファイル

- `.eslintrc.json` - ESLint設定ファイル
- `package-lock.json` - npm依存関係のロックファイル（リポジトリに追加）
- `docs/GITHUB-SECRETS-CHECKLIST.md` - GitHub Secrets設定チェックリスト



