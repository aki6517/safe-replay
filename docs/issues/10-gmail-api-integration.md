### 背景 / 目的

Gmail APIを使用した未読メール取得機能を実装し、Gmailからのメッセージ取得基盤を構築する。

- 依存: #3
- ラベル: `backend`, `gmail`

### スコープ / 作業項目

- Gmail APIクライアントの実装
- OAuth 2.0認証フローの実装（トークン取得・リフレッシュ）
- 未読メール取得機能の実装
- スレッド履歴取得機能の実装
- メッセージ本文抽出機能の実装

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/services/gmail.ts`でGmail APIクライアントを実装
- [x] OAuth 2.0認証フローを実装（トークン取得・リフレッシュ）
- [x] 未読メール取得機能を実装
- [x] スレッド履歴取得機能を実装
- [x] メッセージ本文抽出機能を実装
- [x] エラーハンドリングを実装
- [ ] テスト用のGmailアカウントで動作確認（手作業が必要）

### テスト観点

- リクエスト: Gmail APIを呼び出し、未読メールを取得
- 検証方法: テスト用Gmailアカウントで未読メールを取得し、正しくパースされることを確認

### 完了日

2025-11-29

### 実装内容

#### 1. Gmail APIクライアントの実装（`src/services/gmail.ts`）

- `googleapis`パッケージを使用してGmail APIクライアントを実装
- OAuth 2.0認証フローを実装（リフレッシュトークンを使用）
- 環境変数から認証情報を取得（`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`）

#### 2. 未読メール取得機能

- `getUnreadMessages()`関数を実装
- Gmail APIの`users.messages.list`を使用して未読メールを取得
- 各メッセージの詳細を`users.messages.get`で取得

#### 3. スレッド履歴取得機能

- `getThreadHistory()`関数を実装
- Gmail APIの`users.threads.get`を使用してスレッド内の全メッセージを取得

#### 4. メッセージ本文抽出機能

- `extractMessageBody()`関数を実装
- マルチパートメッセージからテキスト本文を再帰的に抽出
- HTML本文からもテキストを抽出（簡易版）

#### 5. メッセージヘッダー抽出機能

- `extractMessageHeaders()`関数を実装
- From、To、Subject、Dateなどのヘッダー情報を抽出

#### 6. Gmailポーリングサービスの更新（`src/services/poller/gmail.ts`）

- `pollGmail()`関数を実装
- Redisを使用して処理済みメッセージIDを管理（重複処理を防止）
- Supabaseデータベースにメッセージを保存
- エラーハンドリングを実装

### 必要な環境変数

以下の環境変数を設定する必要があります：

- `GMAIL_CLIENT_ID`: Google OAuth 2.0クライアントID
- `GMAIL_CLIENT_SECRET`: Google OAuth 2.0クライアントシークレット
- `GMAIL_REFRESH_TOKEN`: Gmail API用のリフレッシュトークン

### 次のステップ

- Google Cloud ConsoleでGmail APIを有効化
- OAuth 2.0認証情報を取得
- リフレッシュトークンを取得（手作業が必要）
- テスト用Gmailアカウントで動作確認




