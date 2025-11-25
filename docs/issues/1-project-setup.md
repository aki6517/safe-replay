### 背景 / 目的

Node.js + TypeScript + Honoプロジェクトの基本構造と開発環境を構築し、以降の開発の基盤を整える。

- 依存: -
- ラベル: `infra`, `chore`

### スコープ / 作業項目

- プロジェクトの初期化とディレクトリ構造の作成
- 必要な依存パッケージの追加（Hono, Supabase, LINE SDK等）
- TypeScript設定の完了
- 環境変数管理の準備
- 開発環境のセットアップ

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `package.json`に必要な依存パッケージを追加（Hono, Supabase, LINE SDK等）
- [ ] `tsconfig.json`でTypeScript設定を完了
- [ ] `.env.example`を作成し、必要な環境変数を列挙
- [ ] `.gitignore`を設定（node_modules, .env等）
- [ ] `README.md`にセットアップ手順を記載
- [ ] `npm install`で依存パッケージがインストールできる
- [ ] `npm run dev`で開発サーバーが起動する

### テスト観点

- ユニット: なし（設定ファイルのみ）
- 検証方法: `npm install`と`npm run dev`が正常に動作することを確認

