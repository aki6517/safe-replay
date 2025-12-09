### 背景 / 目的

PostgreSQLデータベースのスキーマ作成とマイグレーション実行により、アプリケーションのデータ永続化基盤を構築する。

- 依存: #1
- ラベル: `backend`, `database`

### スコープ / 作業項目

- Supabaseプロジェクトの作成
- データベーススキーマの設計書（`docs/03_database.md`）に基づいたマイグレーションファイルの作成
- 全テーブル、インデックス、RLSポリシーの実装
- マイグレーションの実行と検証

### ゴール / 完了条件（Acceptance Criteria）

- [ ] Supabaseプロジェクトを作成
- [ ] `supabase/migrations/001_initial_schema.sql`を作成（設計書準拠）
- [ ] 全テーブル（users, messages, message_drafts等）を作成
- [ ] インデックスを適切に設定
- [ ] RLSポリシーを設定（Service Role用）
- [ ] `updated_at`トリガーを設定
- [ ] マイグレーションがエラーなく実行できる

### テスト観点

- リクエスト: Supabaseダッシュボードでテーブル構造を確認
- 検証方法: マイグレーションファイルをSupabaseで実行し、エラーなく完了することを確認

