# SafeReply API設計書

> Version: 1.0
> Date: 2026-03-23
> Status: Draft
> Base URL: `https://<project-ref>.supabase.co/functions/v1/safereply`
> 前提: [要件定義書](2026-03-23-safereply-saas-requirements.md), [アーキテクチャ設計書](2026-03-23-architecture-design.md)

---

## 1. 認証方式

| 方式 | 対象エンドポイント | ヘッダー |
|------|-------------------|----------|
| LINE署名検証 | POST /api/v1/line/webhook | `X-Line-Signature: <HMAC-SHA256>` |
| Slack署名検証 | POST /api/slack/events | `X-Slack-Signature: v0=<HMAC>`, `X-Slack-Request-Timestamp` |
| Service Key | POST /api/v1/poll/*, GET /api/v1/health/deep | `Authorization: Bearer <SERVICE_KEY>` |
| LIFF ID Token | POST /api/user/* (今後追加) | リクエストボディにIDトークン |
| なし（公開） | GET /api/v1/health, GET /liff/* | — |

---

## 2. エンドポイント一覧

### 2.1 ヘルスチェック

#### GET /api/v1/health
簡易ヘルスチェック。

**認証**: なし
**レスポンス** `200`:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-23T10:00:00Z"
}
```

#### GET /api/v1/health/deep
DB・Redis・外部サービスの疎通確認。

**認証**: Bearer Token
**レスポンス** `200`:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-23T10:00:00Z",
  "components": {
    "database": { "status": "healthy", "latency_ms": 45 },
    "redis": { "status": "healthy", "latency_ms": 20 },
    "external_services": {
      "gmail_api": { "status": "unknown" },
      "line_api": { "status": "unknown" },
      "openai_api": { "status": "unknown" }
    }
  },
  "version": "1.0.0"
}
```

---

### 2.2 ポーリング

#### POST /api/v1/poll/gmail
単一ユーザーのGmailポーリング。

**認証**: Bearer Token
**リクエスト**:
```json
{
  "line_user_id": "Uxxxxxxxxx",
  "max_results": 50
}
```
**レスポンス** `200`:
```json
{
  "status": "ok",
  "summary": {
    "messages_fetched": 10,
    "messages_new": 3,
    "errors": []
  },
  "processing_time_ms": 2340
}
```

#### POST /api/v1/poll/gmail/all
全アクティブユーザーのGmailを一括ポーリング。

**認証**: Bearer Token
**リクエスト**: `{}` または `{ "max_results": 50 }`
**レスポンス** `200`:
```json
{
  "status": "ok",
  "summary": {
    "users_processed": 5,
    "users_with_errors": 0,
    "total_messages_new": 12,
    "errors": []
  },
  "user_details": [
    {
      "userId": "uuid",
      "gmailEmail": "user@gmail.com",
      "messagesNew": 3,
      "messagesSkipped": 7,
      "errors": []
    }
  ],
  "processing_time_ms": 5670
}
```

#### POST /api/v1/poll/chatwork
Chatworkポーリング（マルチユーザー対応）。

**認証**: Bearer Token
**リクエスト**: `{ "line_user_id": "Uxxxxxxxxx" }` (省略時は全ユーザー)
**レスポンス**: gmail/allと同構造

---

### 2.3 LINE Webhook

#### POST /api/v1/line/webhook
LINE Platformからのイベント受信。

**認証**: LINE署名検証（X-Line-Signature）
**リクエスト**: LINE Webhook Event Envelope
**処理するイベント**:

| イベント | 処理 |
|---------|------|
| message (text) | 編集モード中→修正処理、通常→転送メッセージ処理 |
| postback | アクションボタン処理（send/edit/dismiss/read/acknowledge） |
| follow | ユーザー自動作成（pending）+ ウェルカムメッセージ |
| unfollow | ユーザーステータスをdeletedに変更 |

**レスポンス** `200`:
```json
{ "status": "ok", "processed": 1 }
```

**Postback data形式**:
```
action=send&message_id=<uuid>
action=edit&message_id=<uuid>
action=dismiss&message_id=<uuid>
action=read&message_id=<uuid>
action=acknowledge&message_id=<uuid>
```

---

### 2.4 Slackイベント

#### POST /api/slack/events
Slack Events APIからのイベント受信。

**認証**: Slack署名検証
**リクエスト**: Slack Event Envelope
**処理するイベント**: message, app_mention
**レスポンス**:
- URL verification: `{ "challenge": "..." }`
- イベント処理: `{ "ok": true }` (即座に返し、バックグラウンドで処理)

---

### 2.5 ユーザーAPI

#### POST /api/user/status
ユーザーの連携状況を取得。

**認証**: LIFF（今後ID Token検証追加）
**リクエスト**:
```json
{ "lineUserId": "Uxxxxxxxxx" }
```
**レスポンス** `200`:
```json
{
  "userId": "uuid",
  "status": "active",
  "gmailConnected": true,
  "chatworkConnected": false,
  "slackConnected": true,
  "slackWorkspaceCount": 2,
  "slackWorkspaces": [
    { "teamId": "T...", "teamName": "My Team" }
  ]
}
```

#### POST /api/user/chatwork
ChatworkトークンをDB保存。

**認証**: LIFF
**リクエスト**:
```json
{
  "lineUserId": "Uxxxxxxxxx",
  "chatworkToken": "xxxxxxxxxxxx"
}
```
**レスポンス** `200`: `{ "success": true }`

#### POST /api/user/complete
設定完了処理。Gmail連携必須。

**認証**: LIFF
**リクエスト**: `{ "lineUserId": "Uxxxxxxxxx" }`
**レスポンス** `200`: `{ "success": true }`
**エラー**:
- `400`: Gmail未連携
- `404`: ユーザー未登録

---

### 2.6 OAuth

#### GET /api/oauth/gmail/callback
Google OAuth認可コードを受け取り、トークンをDB保存。

**パラメータ**: `code`, `state` (LINE User ID)
**成功時**: `/liff/callback/success?provider=Gmail` にリダイレクト
**失敗時**: `/liff/callback/error?reason=...` にリダイレクト

#### GET /api/oauth/slack/start
Slack OAuth認可フローを開始。

**パラメータ**: `line_user_id`
**動作**: Slack認可画面にリダイレクト

#### GET /api/oauth/slack/callback
Slack OAuth認可コードを受け取り、slack_installationsにupsert。

**パラメータ**: `code`, `state`
**成功時**: `/liff/callback/success?provider=Slack` にリダイレクト

---

### 2.7 LIFF画面

#### GET /liff/
オンボーディング設定画面（HTML）。

**認証**: LIFF SDK
**内容**: Gmail/Chatwork/Slack連携ウィザード + 設定完了ボタン

#### GET /liff/callback/success
OAuth成功画面。`provider`パラメータで連携先を表示。

#### GET /liff/callback/error
OAuthエラー画面。`reason`パラメータでエラー理由を表示。

---

## 3. エラーレスポンス

全エンドポイント共通のエラー形式:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

| HTTPコード | code | 説明 |
|-----------|------|------|
| 400 | INVALID_REQUEST | リクエスト不正 |
| 401 | INVALID_SIGNATURE | 署名検証失敗 |
| 401 | UNAUTHORIZED | 認証失敗 |
| 403 | FORBIDDEN | アクセス拒否（ホワイトリスト外） |
| 404 | NOT_FOUND | リソース未発見 |
| 500 | INTERNAL_ERROR | サーバーエラー |
| 503 | SERVICE_UNAVAILABLE | サービス利用不可 |

---

## 4. 今後追加予定のエンドポイント

| エンドポイント | 用途 | 優先度 |
|---------------|------|--------|
| POST /api/v1/stripe/webhook | Stripe決済Webhook | 高 |
| POST /api/user/vip | VIPリスト追加・削除 | 高 |
| GET /api/user/templates | 返信テンプレート一覧 | 高 |
| POST /api/user/templates | テンプレート保存 | 高 |
| POST /api/user/snooze | スヌーズ設定 | 高 |
| DELETE /api/user/account | アカウント削除 | 高 |
| GET /api/user/usage | 利用量確認 | 中 |
