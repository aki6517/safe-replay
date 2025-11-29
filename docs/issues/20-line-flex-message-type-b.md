### 背景 / 目的

Type B通知用のFlex Messageテンプレートを実装し、共有・CCメッセージ用のUIを提供する。

- 依存: #18
- ラベル: `backend`, `line`, `ui`

### スコープ / 作業項目

- Type B用Flex Messageテンプレートの作成（設計書`docs/05_sitemap.md`準拠）
- [既読][確認メール]ボタンの実装
- 静音通知設定への対応
- Postbackデータ形式の実装

### ゴール / 完了条件（Acceptance Criteria）

- [ ] Type B用Flex Messageテンプレートを作成（設計書準拠）
- [ ] [既読][確認メール]ボタンを実装
- [ ] 静音通知設定に対応
- [ ] Postbackデータ形式を実装
- [ ] LINE Botで表示確認

### テスト観点

- E2E: LINE BotでFlex Messageが正しく表示されることを確認
- 検証方法: Type B通知を送信し、Flex Messageが正しく表示され、ボタンが動作することを確認




