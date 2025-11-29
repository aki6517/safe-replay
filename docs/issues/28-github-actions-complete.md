### 背景 / 目的

GitHub Actionsの定期実行ワークフローを完成させ、自動ポーリングとヘルスチェックを実現する。

- 依存: #21, #22, #5
- ラベル: `infra`, `automation`, `monitoring`

### スコープ / 作業項目

- ポーリングワークフローの完成（Gmail/Chatworkポーリング実行）
- ヘルスチェックワークフローの完成（ヘルスチェック・異常時通知）
- Service Key認証の実装
- エラー時の通知処理

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `.github/workflows/poll.yml`を完成（Gmail/Chatworkポーリング実行）
- [ ] `.github/workflows/health.yml`を完成（ヘルスチェック・異常時通知）
- [ ] Service Key認証を実装
- [ ] エラー時の通知処理を実装
- [ ] ワークフローが正常に実行される
- [ ] スケジュール実行が動作する

### テスト観点

- CI/CD: GitHub Actionsでワークフローがスケジュール実行されることを確認
- 検証方法: ワークフローが5分間隔（ポーリング）と15分間隔（ヘルスチェック）で正常に実行されることを確認




