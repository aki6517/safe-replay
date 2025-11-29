# Gmail API連携セットアップガイド

## 📋 概要

このガイドでは、Gmail APIを使用して未読メールを取得するためのセットアップ手順を説明します。

## 🔧 セットアップ手順

### Step 1: Google Cloud Consoleでプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）
3. プロジェクト名を入力（例: `SafeReply`）

### Step 2: Gmail APIを有効化

1. 「APIとサービス」→「ライブラリ」をクリック
2. 「Gmail API」を検索
3. 「Gmail API」を選択して「有効にする」をクリック

### Step 3: OAuth同意画面の設定

1. 「APIとサービス」→「OAuth同意画面」をクリック
2. ユーザータイプを選択：
   - **外部**（一般ユーザー向け）または **内部**（Google Workspace内のみ）
3. アプリ情報を入力：
   - アプリ名: `SafeReply`
   - ユーザーサポートメール: あなたのメールアドレス
   - デベロッパーの連絡先情報: あなたのメールアドレス
4. スコープを追加：
   - `https://www.googleapis.com/auth/gmail.readonly`（Gmail読み取り専用）
5. テストユーザーを追加（外部の場合）：
   - あなたのGmailアカウントを追加
6. 「保存して次へ」をクリック

### Step 4: OAuth 2.0認証情報の作成

1. 「APIとサービス」→「認証情報」をクリック
2. 「認証情報を作成」→「OAuth 2.0 クライアント ID」を選択
3. アプリケーションの種類を選択：
   - **デスクトップアプリ** を選択（推奨）
   - または **ウェブアプリケーション** を選択（OAuth 2.0 Playgroundを使用する場合）
4. 名前を入力（例: `SafeReply Desktop Client`）
5. **リダイレクトURIを追加**（重要）：
   - **デスクトップアプリの場合**: `urn:ietf:wg:oauth:2.0:oob`
   - **OAuth 2.0 Playgroundを使用する場合**: `https://developers.google.com/oauthplayground`
6. 「作成」をクリック
7. **クライアントID**と**クライアントシークレット**をコピーして保存

**⚠️ 重要**: 既にOAuth 2.0クライアントIDを作成済みの場合は、以下の手順でリダイレクトURIを追加してください：

1. 「APIとサービス」→「認証情報」をクリック
2. 作成したOAuth 2.0クライアントIDの**編集アイコン（鉛筆マーク）**をクリック
3. **「承認済みのリダイレクトURI」**セクションを探す（「承認済みドメイン」ではありません）
4. 「URIを追加」をクリック
5. リダイレクトURIを入力：
   - デスクトップアプリの場合: `urn:ietf:wg:oauth:2.0:oob`
   - OAuth 2.0 Playgroundの場合: `https://developers.google.com/oauthplayground`
6. 「保存」をクリック

**注意**: 
- 「承認済みドメイン」と「承認済みのリダイレクトURI」は別の設定項目です
- リダイレクトURIには完全なURL（`https://`から始まる）を入力してください
- 複数の方法を使用する場合は、両方のリダイレクトURIを追加してください

### Step 5: リフレッシュトークンの取得

リフレッシュトークンを取得するには、OAuth認証フローを実行する必要があります。

#### 方法1: Node.jsスクリプトを使用（推奨）

プロジェクトルートに `scripts/get-gmail-refresh-token.ts` を作成して実行します。

```bash
npm run get-gmail-refresh-token
```

#### 方法2: OAuth 2.0 Playgroundを使用（手動で取得）

**⚠️ 重要**: OAuth 2.0 Playgroundを使用する場合は、Step 4でリダイレクトURI `https://developers.google.com/oauthplayground` を追加してください。

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)にアクセス
2. 左側の「OAuth 2.0 Configuration」で「Use your own OAuth credentials」にチェック
3. クライアントIDとシークレットを入力
4. 左側のスコープ一覧から以下を選択：
   - `https://www.googleapis.com/auth/gmail.readonly`
5. 「Authorize APIs」をクリック
6. Googleアカウントでログインして権限を付与
7. 「Exchange authorization code for tokens」をクリック
8. **Refresh token**をコピーして保存

**エラーが発生する場合**:
- `redirect_uri_mismatch`エラーが表示される場合は、Google Cloud ConsoleでリダイレクトURI `https://developers.google.com/oauthplayground` が追加されているか確認してください。

### Step 6: 環境変数の設定

`.env`ファイルに以下を追加：

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here
```

### Step 7: 動作確認

#### 7.1 事前準備

1. `.env`ファイルに以下の環境変数が設定されていることを確認：
   ```env
   GMAIL_CLIENT_ID=your_client_id_here
   GMAIL_CLIENT_SECRET=your_client_secret_here
   GMAIL_REFRESH_TOKEN=your_refresh_token_here
   ```

2. テスト用の未読メールを準備（オプション）：
   - Gmailアカウントに未読メールが1件以上あると、より詳細なテストが可能です
   - 未読メールがない場合でも、基本的な動作確認は可能です

#### 7.2 テストスクリプトの実行

以下のコマンドを実行して動作確認：

```bash
npm run test-gmail-api
```

**期待される結果**:
- ✅ 環境変数の確認が成功
- ✅ Gmail APIクライアントが利用可能
- ✅ 未読メールの取得が成功（未読メールがない場合は0件と表示）
- ✅ メッセージの詳細が正しく表示される（未読メールがある場合）

**エラーが発生した場合**:
- リフレッシュトークンが有効か確認してください
- Gmail APIが有効になっているか確認してください
- OAuth同意画面でスコープが正しく設定されているか確認してください

#### 7.3 APIエンドポイント経由でテスト（オプション）

アプリケーションを起動してポーリングエンドポイントを呼び出すこともできます：

```bash
# ローカル環境でアプリを起動
npm run dev

# 別のターミナルでポーリングエンドポイントを呼び出し
curl -X POST http://localhost:3000/api/v1/poll/gmail \
  -H "X-Service-Key: your_service_key"
```

## 🧪 テスト方法

### テストスクリプトの実行

```bash
npm run test-gmail-api
```

### APIエンドポイント経由でテスト

```bash
# ローカル環境
curl -X POST http://localhost:3000/api/v1/poll/gmail \
  -H "X-Service-Key: your_service_key"

# Railway環境
curl -X POST https://your-app.railway.app/api/v1/poll/gmail \
  -H "X-Service-Key: your_service_key"
```

## ⚠️ 注意事項

1. **リフレッシュトークンの有効期限**
   - リフレッシュトークンは通常無期限ですが、ユーザーが権限を取り消した場合は無効になります
   - 定期的に動作確認を行うことを推奨します

2. **APIクォータ制限**
   - Gmail APIには1日あたりのリクエスト数に制限があります
   - デフォルトは1日250,000リクエスト（プロジェクト単位）
   - 必要に応じてクォータ増加をリクエストできます

3. **セキュリティ**
   - クライアントシークレットとリフレッシュトークンは絶対に公開しないでください
   - `.env`ファイルは`.gitignore`で除外されていることを確認してください

## 🔍 トラブルシューティング

### エラー: "redirect_uri_mismatch"

- OAuth 2.0クライアントIDの設定でリダイレクトURIが正しく設定されているか確認してください
- **デスクトップアプリの場合**: `urn:ietf:wg:oauth:2.0:oob` が追加されているか確認
- **OAuth 2.0 Playgroundを使用する場合**: `https://developers.google.com/oauthplayground` が追加されているか確認
- リダイレクトURIは完全一致する必要があります（大文字小文字も含む）

### エラー: "invalid_grant"

- リフレッシュトークンが無効になっている可能性があります
- 新しいリフレッシュトークンを取得してください

### エラー: "insufficient permissions"

- OAuth同意画面でスコープが正しく設定されているか確認してください
- テストユーザーに自分のGmailアカウントが追加されているか確認してください

### エラー: "API not enabled"

- Gmail APIが有効になっているか確認してください
- プロジェクトが正しく選択されているか確認してください

## 📚 参考資料

- [Gmail API ドキュメント](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Server to Server Applications](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Google Cloud Console](https://console.cloud.google.com/)

