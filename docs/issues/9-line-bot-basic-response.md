### 背景 / 目的

LINE Botへの基本的なテキストメッセージ送信機能を実装し、ユーザーとの双方向通信を可能にする。

- 依存: #8
- ラベル: `backend`, `line`

### スコープ / 作業項目

- LINE Bot SDKクライアントの初期化
- テキストメッセージ送信関数の実装
- followイベント時のウェルカムメッセージ実装
- エラーハンドリング

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/services/line.ts`でLINE Bot SDKクライアントを初期化（既に実装済み）
- [x] テキストメッセージ送信関数を実装
- [x] followイベント時のウェルカムメッセージを実装
- [x] エラーハンドリングを実装
- [ ] LINE Botにメッセージが送信できることを確認（手作業が必要）

### 実装内容

#### 作成・更新したファイル

1. **`src/services/line.ts`** - LINE Messaging APIサービス
   - `sendTextMessage()` - プッシュメッセージ送信関数を追加
   - `replyTextMessage()` - リプライメッセージ送信関数を追加
   - エラーハンドリングを実装

2. **`src/routes/line-webhook.ts`** - LINE Webhookエンドポイント
   - `follow`イベント時にウェルカムメッセージを送信する処理を追加

#### 実装詳細

- **プッシュメッセージ**: `sendTextMessage(userId, text)` - 任意のタイミングでユーザーにメッセージを送信
- **リプライメッセージ**: `replyTextMessage(replyToken, text)` - Webhookイベントへの応答としてメッセージを送信
- **ウェルカムメッセージ**: ユーザーがBotを友だち追加した際に自動的に送信

### テスト観点

- E2E: LINE Botに友だち追加し、ウェルカムメッセージが表示されることを確認
- 検証方法: プログラムからメッセージを送信し、LINE Botに表示されることを確認

### 完了日

2025-11-29




