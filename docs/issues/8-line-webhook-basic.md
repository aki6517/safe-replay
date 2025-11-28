### 背景 / 目的

LINE Messaging APIのWebhookエンドポイントと署名検証を実装し、LINE Botとの通信基盤を構築する。

- 依存: #4, #3
- ラベル: `backend`, `line`

### スコープ / 作業項目

- LINE Webhookエンドポイントの実装
- LINE署名検証ロジックの実装
- イベントタイプのルーティング（message, postback, follow, unfollow）
- エラーハンドリング

### ゴール / 完了条件（Acceptance Criteria）

- [x] `POST /api/v1/line/webhook`エンドポイントを実装
- [x] LINE署名検証ロジックを実装
- [x] イベントタイプ（message, postback, follow, unfollow）のルーティング
- [x] エラーハンドリングを実装
- [x] 型定義の追加（`src/types/line-webhook.ts`）
- [ ] LINE Developer ConsoleでWebhook URLを設定できる（手作業が必要）
- [ ] テストメッセージを送信して受信できる（手作業が必要）

### 実装内容

#### 作成・更新したファイル

1. **`src/routes/line-webhook.ts`** - LINE Webhookエンドポイント
   - `POST /api/v1/line/webhook`エンドポイントを実装
   - LINE署名検証ロジックを実装
   - イベントタイプ（message, postback, follow, unfollow）のルーティング
   - エラーハンドリングを実装
   - 型定義を使用して`any`型を排除

2. **`src/types/line-webhook.ts`** - LINE Webhookイベント型定義（新規作成）
   - `LineWebhookRequest` - Webhookリクエストボディの型
   - `LineWebhookEvent` - イベントの共通型
   - `MessageEvent` - メッセージイベントの型
   - `PostbackEvent` - ポストバックイベントの型
   - `FollowEvent` - フォローイベントの型
   - `UnfollowEvent` - アンフォローイベントの型

#### 実装詳細

- **署名検証**: `X-Line-Signature`ヘッダーを使用してリクエストの正当性を検証
- **イベント処理**:
  - `message` (text): 転送メッセージとして処理（`processForwardedMessage`を呼び出し）
  - `message` (file): ログ出力のみ（将来実装予定）
  - `postback`: アクションボタン処理（`handleLineAction`を呼び出し）
  - `follow`: ログ出力のみ（将来実装予定）
  - `unfollow`: ログ出力のみ（将来実装予定）

### LINE Developer ConsoleでのWebhook URL設定手順

1. **LINE Developers Consoleにアクセス**
   - https://developers.line.biz/ja/ にアクセス
   - プロバイダーを選択

2. **チャネル設定を開く**
   - 「Messaging API」チャネルを選択
   - 「Messaging API設定」タブを開く

3. **Webhook URLを設定**
   - 「Webhook URL」セクションで「編集」をクリック
   - Webhook URLを入力: `https://safe-replay-production.up.railway.app/api/v1/line/webhook`
   - 「更新」をクリック

4. **Webhookの利用を有効化**
   - 「Webhookの利用」を「利用する」に設定
   - 「検証」ボタンをクリックして、Webhook URLが正しく設定されているか確認

5. **Webhookイベントの設定**
   - 「Webhookイベント」セクションで、必要なイベントを有効化：
     - `message` - メッセージイベント
     - `postback` - ポストバックイベント
     - `follow` - フォローイベント
     - `unfollow` - アンフォローイベント

### テスト観点

- リクエスト: LINE Developer Consoleからテストメッセージを送信
- 検証方法: Webhookエンドポイントがメッセージを受信し、正常に処理されることを確認
- 署名検証: 不正な署名のリクエストが拒否されることを確認

### 完了日

2025-11-27




