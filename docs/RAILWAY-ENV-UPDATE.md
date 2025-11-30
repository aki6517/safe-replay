# Railway環境変数の更新手順

## 問題

Supabase Legacy API keysが無効化されたため、Railwayの環境変数を新しいAPI keysに更新する必要があります。

## 更新が必要な環境変数

### 1. Supabase Service Role Key

**旧環境変数名:** `SUPABASE_SERVICE_ROLE_KEY`  
**新しい値:** `sb_secret_...` で始まるSecret Key

**更新手順:**
1. Supabase Dashboardにアクセス
2. Settings > API > Secret Keys
3. `sb_secret_...` で始まるキーをコピー
4. Railwayの環境変数 `SUPABASE_SERVICE_ROLE_KEY` を更新

### 2. Supabase Anon Key

**旧環境変数名:** `SUPABASE_ANON_KEY`  
**新しい値:** `sb_publishable_...` で始まるPublishable Key

**更新手順:**
1. Supabase Dashboardにアクセス
2. Settings > API > Publishable Keys
3. `sb_publishable_...` で始まるキーをコピー
4. Railwayの環境変数 `SUPABASE_ANON_KEY` を更新

## Railwayでの環境変数更新方法

### 方法1: Railway Dashboardから更新

1. Railwayプロジェクトにアクセス
2. 「Variables」タブを開く
3. 以下の環境変数を更新：
   - `SUPABASE_SERVICE_ROLE_KEY` → 新しいSecret Keyに更新
   - `SUPABASE_ANON_KEY` → 新しいPublishable Keyに更新
4. 保存後、自動的に再デプロイされます

### 方法2: Railway CLIから更新

```bash
# Railway CLIをインストール（未インストールの場合）
npm i -g @railway/cli

# Railwayにログイン
railway login

# プロジェクトを選択
railway link

# 環境変数を更新
railway variables set SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
railway variables set SUPABASE_ANON_KEY="sb_publishable_..."
```

## 確認方法

環境変数更新後、以下の方法で確認できます：

### 1. Railwayログで確認

再デプロイ後、ログに以下のようなエラーが出なくなれば成功：
- ❌ `Legacy API keys are disabled`
- ✅ 正常にメッセージ処理が開始される

### 2. ヘルスチェックで確認

```bash
# RailwayのURLを使用
curl https://your-railway-app.railway.app/api/v1/health/deep
```

正常な場合、`supabase: "ok"` が返ります。

## 注意事項

- 環境変数更新後、自動的に再デプロイされます
- 再デプロイには数分かかる場合があります
- 更新後、LINE Botに再度メッセージを送信して動作確認してください

