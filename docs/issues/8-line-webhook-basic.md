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
- [x] LINE Developer ConsoleでWebhook URLを設定できる（完了）
- [x] テストメッセージを送信して受信できる（完了）

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
   - 検証が成功すると「Webhook URLの検証に成功しました」と表示されます

**注意**: 
- Webhookイベントの種類（`message`, `postback`, `follow`, `unfollow`など）は、LINEプラットフォームが自動的に送信するため、LINE Developer Consoleで個別に設定する必要はありません
- 実装したコードで、受信したイベントの種類に応じて適切に処理するように実装されています
- 参考: [LINE Developers - メッセージ（Webhook）を受信する](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/#webhook-event-in-one-on-one-talk-or-group-chat)

### テスト観点

- リクエスト: LINE Developer Consoleからテストメッセージを送信
- 検証方法: Webhookエンドポイントがメッセージを受信し、正常に処理されることを確認
- 署名検証: 不正な署名のリクエストが拒否されることを確認

### 完了日

2025-11-29

### 完了時の状況

- ✅ Webhook URL設定完了: `https://safe-replay-production.up.railway.app/api/v1/line/webhook`
- ✅ Webhookの利用を有効化
- ✅ テストメッセージ送信・受信確認完了
- ✅ RailwayログでWebhookイベント受信を確認
- ✅ メッセージ処理が正常に実行されることを確認
- ⚠️ 注意: LINE Developer Consoleの「応答メッセージ」は無効に推奨（Issue #9でプログラムから返信を実装するため）




