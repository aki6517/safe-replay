### 背景 / 目的

SupabaseとUpstash Redisの接続クライアントを実装し、アプリケーションからデータベースとキャッシュへのアクセスを可能にする。

- 依存: #2
- ラベル: `backend`, `infra`

### スコープ / 作業項目

- Supabaseクライアントの初期化と設定
- Upstash Redisクライアントの初期化と設定
- 環境変数の検証ロジック
- 接続エラーハンドリング
- TypeScript型定義の作成

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `src/db/client.ts`でSupabaseクライアントを初期化
- [ ] `src/db/redis.ts`でUpstash Redisクライアントを初期化
- [ ] 環境変数の検証ロジックを実装
- [ ] 接続エラー時のハンドリングを実装
- [ ] 型定義（`src/types/database.ts`）を作成

### テスト観点

- ユニット: クライアント初期化関数のテスト
- 検証方法: 環境変数を設定し、クライアントが正常に初期化されることを確認




