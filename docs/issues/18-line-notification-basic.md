### 背景 / 目的

LINE Botへの通知送信機能を実装し、ユーザーへの通知基盤を構築する（テキストメッセージ版）。

- 依存: #9, #17
- ラベル: `backend`, `line`

### スコープ / 作業項目

- 通知サービスの実装
- Type A通知送信機能（テキスト + 返信案）
- Type B通知送信機能（テキスト）
- Type Cは通知しない（ログのみ）
- 通知履歴のDB記録

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/services/notifier.ts`で通知サービスを実装
- [x] Type A通知送信機能を実装（テキスト + 返信案）
- [x] Type B通知送信機能を実装（テキスト）
- [x] Type Cは通知しない（ログのみ）
- [x] 通知履歴をDBに記録
- [x] エラーハンドリングを実装
- [x] テストスクリプトの作成（`scripts/test-line-notification.ts`）

### テスト観点

- E2E: トリアージ結果に応じて通知が送信されることを確認
- 検証方法: Type A/B/Cの各パターンで、適切な通知が送信されることを確認

### テストスクリプト

**動作確認コマンド**:
```bash
npm run test-line-notification
```

**必要な環境変数**:
- `LINE_CHANNEL_ACCESS_TOKEN` (必須)
- `LINE_CHANNEL_SECRET` (必須)
- `LINE_TEST_USER_ID` (必須、テスト用LINE User ID)
- `SUPABASE_URL` (必須、DB記録用)
- `SUPABASE_SERVICE_ROLE_KEY` (必須、DB記録用)

### 動作確認結果

**確認日**: 2025-11-29

**テスト結果**:
- ✅ LINE通知サービス実装完了
- ✅ Type A通知: テキスト + 返信案の送信成功
- ✅ Type B通知: テキストのみの送信成功
- ✅ Type C通知: 通知スキップ（ログのみ）正常動作
- ✅ 通知履歴のDB記録: 正常動作（`notified_at`更新、`status`更新）

**テストコマンド**:
```bash
npm run test-line-notification
```




