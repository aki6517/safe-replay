### 背景 / 目的

システム異常時にユーザーへ緊急LINE通知を送信する機能を実装し、運用保全を強化する。

- 依存: #9, #26
- ラベル: `backend`, `monitoring`, `security`

### スコープ / 作業項目

- 緊急通知関数の実装
- APIトークン失効検知時の通知
- システム停止検知時の通知
- 緊急通知用Flex Messageテンプレートの作成

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/utils/emergency-notification.ts`で緊急通知関数を実装
- [x] APIトークン失効検知時に通知（Gmail、Chatwork、OpenAI）
- [x] システム停止検知時に通知（データベース接続エラー）
- [x] 緊急通知用Flex Messageテンプレートを作成（`src/services/flex-messages/emergency.ts`）
- [x] エラーハンドリングを実装（重複通知防止機能付き）

### テスト観点

- E2E: システム異常をシミュレートし、緊急通知が送信されることを確認
- 検証方法: APIトークン失効やシステム停止をシミュレートし、LINE Botに緊急通知が送信されることを確認




