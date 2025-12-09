### 背景 / 目的

CI/CDと定期実行のためのGitHub Actionsワークフローを作成し、自動化の基盤を整える。

- 依存: #6
- ラベル: `infra`, `ci`

### スコープ / 作業項目

- 自動デプロイワークフローの作成
- ポーリングワークフローの作成（スケルトン）
- ヘルスチェックワークフローの作成（スケルトン）
- GitHub Secretsの設定

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `.github/workflows/deploy.yml`を作成（自動デプロイ）
- [ ] `.github/workflows/poll.yml`を作成（5分間隔ポーリング、スケルトン）
- [ ] `.github/workflows/health.yml`を作成（15分間隔ヘルスチェック、スケルトン）
- [ ] GitHub Secretsに必要な値を設定
- [ ] ワークフローが正常に実行される

### テスト観点

- CI/CD: GitHub Actionsでワークフローが実行されることを確認
- 検証方法: ワークフローが正常に実行され、エラーなく完了することを確認

