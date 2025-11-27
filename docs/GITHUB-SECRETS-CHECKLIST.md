# GitHub Secrets設定チェックリスト

## 必要なSecrets一覧

`poll.yml`と`health.yml`で使用されるSecretsです。

### 必須Secrets

| Secret名 | 説明 | 現在の値 | 設定場所 |
|---------|------|---------|---------|
| `API_BASE_URL` | デプロイされたAPIのベースURL | `https://safe-replay-production.up.railway.app` | GitHub → Settings → Secrets and variables → Actions |
| `SERVICE_KEY` | ヘルスチェック・ポーリング用の認証キー | `KnXHpLZziKJFFtwsz02IWhMzPcZy2uNgtO4ljS/qV/8=` | GitHub → Settings → Secrets and variables → Actions |

### オプションSecrets（現在は使用していません）

| Secret名 | 説明 | 備考 |
|---------|------|------|
| `RAILWAY_TOKEN` | Railway APIトークン | CIワークフローでは使用していません（Railwayの自動デプロイを使用） |
| `RAILWAY_SERVICE_NAME` | Railwayサービス名 | CIワークフローでは使用していません |

---

## 設定手順

### 1. GitHubリポジトリの設定画面に移動

1. GitHubリポジトリ（`https://github.com/aki6517/safe-replay`）にアクセス
2. 「Settings」タブをクリック
3. 左メニューから「Secrets and variables」→「Actions」を選択

### 2. Secretsの追加・確認

#### `API_BASE_URL`の設定

1. 「New repository secret」をクリック
2. 以下を入力：
   - **Name**: `API_BASE_URL`
   - **Secret**: `https://safe-replay-production.up.railway.app`
3. 「Add secret」をクリック

#### `SERVICE_KEY`の設定

1. 「New repository secret」をクリック
2. 以下を入力：
   - **Name**: `SERVICE_KEY`
   - **Secret**: `KnXHpLZziKJFFtwsz02IWhMzPcZy2uNgtO4ljS/qV/8=`
3. 「Add secret」をクリック

---

## 設定確認方法

### 方法1: GitHub Secrets画面で確認

1. GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」に移動
2. 以下のSecretsが表示されているか確認：
   - `API_BASE_URL`
   - `SERVICE_KEY`

### 方法2: ワークフローを手動実行して確認

1. GitHubリポジトリの「Actions」タブを開く
2. 「Poll Messages」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. 「Run workflow」をクリック
5. ワークフローが正常に実行されるか確認

---

## 注意事項

- `SERVICE_KEY`は、Railwayの環境変数`SERVICE_KEY`と同じ値である必要があります
- `API_BASE_URL`は、Railwayで生成されたドメインURLを使用してください
- Secretsは一度設定すると、値は表示されません（更新または削除のみ可能）

---

## トラブルシューティング

### Secretsが設定されていない場合

- ワークフロー実行時にエラーが発生します
- エラーメッセージ: `API_BASE_URL`または`SERVICE_KEY`が見つからない

### Secretsの値が間違っている場合

- ワークフローは実行されますが、API呼び出しが失敗します
- エラーメッセージ: `401 Unauthorized`（認証エラー）または`404 Not Found`（URLエラー）

### 確認方法

1. Railwayの環境変数で`SERVICE_KEY`が正しく設定されているか確認
2. `API_BASE_URL`が正しいURLか確認（`https://safe-replay-production.up.railway.app`）
3. ヘルスチェックAPIに直接アクセスして動作確認：
   ```
   curl https://safe-replay-production.up.railway.app/api/v1/health
   ```

