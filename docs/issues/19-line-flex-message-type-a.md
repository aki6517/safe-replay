### 背景 / 目的

Type A通知用のFlex Messageテンプレートを実装し、リッチなUIで返信案とアクションボタンを提供する。

- 依存: #18
- ラベル: `backend`, `line`, `ui`

### スコープ / 作業項目

- Type A用Flex Messageテンプレートの作成（設計書`docs/05_sitemap.md`準拠）
- 返信案プレビューの表示
- [送信][修正][断る]ボタンの実装
- Postbackデータ形式の実装

### ゴール / 完了条件（Acceptance Criteria）

- [ ] Type A用Flex Messageテンプレートを作成（設計書準拠）
- [ ] 返信案プレビューを表示
- [ ] [送信][修正][断る]ボタンを実装
- [ ] Postbackデータ形式を実装
- [ ] LINE Botで表示確認

### テスト観点

- E2E: LINE BotでFlex Messageが正しく表示されることを確認
- 検証方法: Type A通知を送信し、Flex Messageが正しく表示され、ボタンが動作することを確認




