### 背景 / 目的

Chatwork APIを使用した自分宛メッセージ取得機能を実装し、Chatworkからのメッセージ取得基盤を構築する。

- 依存: #3
- ラベル: `backend`, `chatwork`

### スコープ / 作業項目

- Chatwork APIクライアントの実装
- APIトークン認証の実装
- ルーム一覧取得機能の実装
- 自分宛（To/Direct）メッセージ取得機能の実装
- 無限ループ防止（自身のBot発言除外）の実装

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/services/chatwork.ts`でChatwork APIクライアントを実装
- [x] APIトークン認証を実装
- [x] ルーム一覧取得機能を実装
- [x] 自分宛（To/Direct）メッセージ取得機能を実装
- [x] 無限ループ防止（自身のBot発言除外）を実装
- [x] エラーハンドリングを実装
- [x] ポーリングサービスの更新（`src/services/poller/chatwork.ts`）
- [x] テストスクリプトの作成（`scripts/test-chatwork-api.ts`）
- [x] テスト用のChatworkアカウントで動作確認（完了）

### セットアップ手順

**詳細なセットアップ手順**: `docs/CHATWORK-API-SETUP.md` を参照してください。

**テストスクリプト**:
- Chatwork API動作確認: `npm run test-chatwork-api`

### テスト観点

- リクエスト: Chatwork APIを呼び出し、自分宛メッセージを取得
- 検証方法: テスト用Chatworkアカウントで自分宛メッセージを取得し、正しくパースされることを確認

### 動作確認結果

**確認日**: 2025-11-29

**テスト結果**:
- ✅ 環境変数の設定確認: 成功
- ✅ Chatwork APIクライアントの初期化: 成功
- ✅ 自分のChatwork IDの取得: 成功（ID: 2704607）
- ✅ ルーム一覧の取得: 成功（181件のルームを取得）
- ✅ 自分宛メッセージの取得: 成功（10件の自分宛メッセージを取得）
- ✅ メッセージ本文の抽出: 成功（Toタグが正しく除去されている）

**テストコマンド**:
```bash
npm run test-chatwork-api
```




