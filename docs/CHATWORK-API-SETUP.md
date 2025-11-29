# Chatwork API連携セットアップガイド

このドキュメントでは、Chatwork API連携のセットアップ手順を説明します。

## 📋 目次

1. [Chatwork APIトークンの取得](#1-chatwork-apiトークンの取得)
2. [環境変数の設定](#2-環境変数の設定)
3. [動作確認](#3-動作確認)
4. [トラブルシューティング](#4-トラブルシューティング)

---

## 1. Chatwork APIトークンの取得

### Step 1: Chatworkにログイン

1. [Chatwork](https://www.chatwork.com/)にログインします

### Step 2: APIトークンの生成

1. Chatworkの右上のアカウントメニューから「設定」をクリック
2. 左メニューから「API」を選択
3. 「APIトークン」セクションで「新しいAPIトークンを発行」をクリック
4. APIトークンが表示されるので、**必ずコピーして保存**してください
   - ⚠️ **重要**: APIトークンは一度しか表示されません。失くした場合は再発行が必要です

### Step 3: 自分のChatwork IDを確認（オプション）

自分のChatwork IDは、APIから自動取得されますが、手動で設定することもできます。

1. Chatworkの右上のアカウントメニューから「設定」をクリック
2. 「アカウント情報」で自分のIDを確認できます
   - または、APIエンドポイント `/me` で取得できます

---

## 2. 環境変数の設定

### `.env`ファイルに以下を追加

```env
# Chatwork API
CHATWORK_API_TOKEN=your_chatwork_api_token_here
CHATWORK_MY_ID=your_chatwork_my_id_here  # オプション: 自動取得されます
```

### 環境変数の説明

- **`CHATWORK_API_TOKEN`** (必須)
  - Chatwork APIトークン
  - Step 2で取得したAPIトークンを設定

- **`CHATWORK_MY_ID`** (オプション)
  - 自分のChatwork ID
  - 設定しない場合は、APIから自動取得されます
  - 無限ループ防止（自分自身のメッセージを除外）に使用されます

---

## 3. 動作確認

### テストスクリプトの実行

```bash
npm run test-chatwork-api
```

### 期待される出力

```
🧪 Chatwork API動作確認テスト

1️⃣ 環境変数の確認...
   ✅ CHATWORK_API_TOKEN: xxxxxxxxxx...
   ℹ️  CHATWORK_MY_ID: 未設定（自動取得されます）

2️⃣ Chatwork APIクライアントの確認...
   ✅ Chatwork APIクライアントが利用可能です

3️⃣ 自分のChatwork IDを取得...
   ✅ 自分のID: 123456

4️⃣ ルーム一覧の取得...
   ✅ 5件のルームを取得しました

5️⃣ 自分宛メッセージの取得...
   ✅ 3件の自分宛メッセージを取得しました

6️⃣ メッセージの詳細表示...
   📧 メッセージ #1:
      ID: 1234567890
      From: テストユーザー (ID: 123456)
      Date: 2025/11/29 12:00:00
      Body (extracted): メッセージ本文...
      Body length: 100 characters

✅ すべてのテストが成功しました！
```

### テスト用の自分宛メッセージの作成

テスト用に、Chatworkで自分宛メッセージを作成してください：

1. 任意のルームを開く
2. メッセージ本文に `[To:自分のID]` を含めて送信
   - 例: `[To:123456] これはテストメッセージです`

---

## 4. トラブルシューティング

### エラー: `Chatwork API token not configured`

**原因**: 環境変数 `CHATWORK_API_TOKEN` が設定されていない

**解決方法**:
1. `.env`ファイルに `CHATWORK_API_TOKEN` を設定
2. サーバーを再起動

### エラー: `401 Unauthorized`

**原因**: APIトークンが無効または期限切れ

**解決方法**:
1. Chatworkの設定画面でAPIトークンを再発行
2. `.env`ファイルの `CHATWORK_API_TOKEN` を更新
3. サーバーを再起動

### エラー: `403 Forbidden`

**原因**: APIトークンに必要な権限がない

**解決方法**:
1. Chatworkの設定画面でAPIトークンの権限を確認
2. 必要に応じてAPIトークンを再発行

### エラー: `429 Too Many Requests`

**原因**: APIのレート制限に達した

**解決方法**:
1. しばらく待ってから再試行
2. Chatwork APIのレート制限を確認（通常は1分間に100リクエスト）

### 自分宛メッセージが取得できない

**原因**: メッセージ本文に `[To:自分のID]` が含まれていない

**解決方法**:
1. メッセージ本文に `[To:自分のID]` を含めて送信
2. 自分のIDは、`npm run test-chatwork-api` で確認できます

### 自分自身のメッセージが取得される

**原因**: 無限ループ防止のロジックが正しく動作していない

**解決方法**:
1. `CHATWORK_MY_ID` 環境変数が正しく設定されているか確認
2. または、APIから自動取得されたIDが正しいか確認

---

## 📚 参考資料

- [Chatwork API ドキュメント](https://developer.chatwork.com/ja/)
- [Chatwork API リファレンス](https://developer.chatwork.com/reference)

---

## ✅ セットアップ完了チェックリスト

- [ ] Chatwork APIトークンを取得
- [ ] `.env`ファイルに `CHATWORK_API_TOKEN` を設定
- [ ] (オプション) `.env`ファイルに `CHATWORK_MY_ID` を設定
- [ ] `npm run test-chatwork-api` で動作確認
- [ ] 自分宛メッセージが正しく取得できることを確認
- [ ] 自分自身のメッセージが除外されることを確認


