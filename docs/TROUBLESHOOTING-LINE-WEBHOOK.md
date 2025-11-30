# LINE Webhook トラブルシューティングガイド

## 問題: LINE Botにメッセージを送信しても応答がない

### 確認事項

#### 1. ホワイトリストの設定確認

環境変数 `LINE_ALLOWED_USER_IDS` に自分のLINE User IDが含まれているか確認してください。

```bash
# ローカル環境で確認
npm run test-whitelist
```

**確認ポイント:**
- 環境変数が正しく読み込まれているか
- 自分のLINE User IDが許可リストに含まれているか

#### 2. LINE User IDの取得方法

LINE User IDを確認する方法：

1. **LINE Botにメッセージを送信**
   - LINE Botに何かメッセージを送信
   - Railwayのログを確認（`userId`が表示される）

2. **followイベントで確認**
   - LINE Botを友達追加
   - Railwayのログに `User followed: [LINE_USER_ID]` が表示される

3. **テストスクリプトで確認**
   ```bash
   npm run test-line-notification
   ```

#### 3. Railwayログの確認

Railwayのダッシュボードでログを確認：

1. Railwayプロジェクトにアクセス
2. 「Deployments」→ 最新のデプロイメントを選択
3. 「View Logs」をクリック

**確認すべきログ:**
- `[セキュリティ] 許可されていないユーザーからのアクセス: [USER_ID]` → ホワイトリストに登録されていない
- `User followed: [USER_ID]` → 友達追加イベント
- `LINE Webhook error:` → エラーが発生している

#### 4. ホワイトリスト検証の動作確認

**正常な動作:**
- 許可されたユーザー: メッセージが処理される
- 未登録ユーザー: 処理がスキップされ、ログに警告が記録される

**問題がある場合:**
- 環境変数が設定されていない → 開発環境では警告を出して許可、本番環境では拒否
- LINE User IDが一致しない → 正確なUser IDを確認して設定

### デバッグ手順

#### ステップ1: 環境変数の確認

```bash
# ローカル環境でテスト
npm run test-whitelist
```

出力例：
```
環境変数 LINE_ALLOWED_USER_IDS: Udaecd8389647458778ad52e9fea63f6a
許可されたユーザーIDリスト: Udaecd8389647458778ad52e9fea63f6a
ユーザーID: Udaecd8389647458778ad52e9fea63f6a → ✅ 許可
```

#### ステップ2: LINE Botにメッセージを送信

1. LINEアプリでBotにメッセージを送信
2. Railwayのログを確認
3. 以下のログが表示されるか確認：
   - `[セキュリティ] 許可されていないユーザーからのアクセス:` → ホワイトリストに登録されていない
   - または、メッセージ処理のログ → 正常に処理されている

#### ステップ3: ログからLINE User IDを確認

Railwayのログに表示される `userId` を確認し、環境変数と一致しているか確認してください。

### よくある問題と解決方法

#### 問題1: ホワイトリストに登録されているのに拒否される

**原因:**
- LINE User IDが正確でない（余分なスペース、大文字小文字の違いなど）

**解決方法:**
1. Railwayのログから正確なUser IDをコピー
2. `.env`ファイル（またはRailwayの環境変数）を更新
3. アプリケーションを再デプロイ

#### 問題2: 開発環境では動作するが本番環境では動作しない

**原因:**
- 本番環境の環境変数が設定されていない
- `NODE_ENV=production` が設定されている

**解決方法:**
1. Railwayの環境変数設定を確認
2. `LINE_ALLOWED_USER_IDS` が設定されているか確認
3. 必要に応じて設定を追加

#### 問題3: メッセージを送信しても何も起こらない

**確認事項:**
1. LINE Webhook URLが正しく設定されているか
2. RailwayのログにWebhookリクエストが届いているか
3. 署名検証が成功しているか（`INVALID_SIGNATURE`エラーが出ていないか）

### テスト方法

#### テスト1: ホワイトリスト検証のテスト

```bash
npm run test-whitelist
```

#### テスト2: LINE通知のテスト

```bash
npm run test-line-notification
```

#### テスト3: 実際のLINE Botでテスト

1. LINE Botにメッセージを送信
2. Railwayのログを確認
3. ホワイトリスト検証のログを確認

### ログの見方

**正常なログ:**
```
[LINE Webhook] Event received: message
User ID: Udaecd8389647458778ad52e9fea63f6a
[転送メッセージ処理開始] { lineUserId: 'Udaecd8389647458778ad52e9fea63f6a', textLength: 50 }
```

**ホワイトリストで拒否されたログ:**
```
[セキュリティ] 許可されていないユーザーからのアクセス: [USER_ID]
```

**エラーログ:**
```
LINE Webhook error: [エラーメッセージ]
```

