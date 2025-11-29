# SafeReply プロジェクト - 引き継ぎプロンプト

## 📋 プロジェクト概要

**SafeReply** - AI自動返信アシスタント

ADHD特性による「連絡業務への心理的抵抗感・先延ばし」を解消し、返信遅れによる信用失墜や機会損失を防ぐためのAI自動返信アシスタント。

**ターゲット**: 複数のチャットツール（Gmail, Chatwork, LINE）を利用するフリーランス・個人事業主

**開発規模**: 1名の非エンジニア開発者がAIツール（Cursor）を使用して運用・保守

---

## 🛠️ 技術スタック

- **バックエンド**: Node.js 20+ + TypeScript + Hono 3.12.0
- **データベース**: PostgreSQL (Supabase)
- **キャッシュ**: Redis (Upstash)
- **インフラ**: Railway + GitHub Actions
- **AI**: OpenAI API (GPT-4o-mini) - Model Agnostic設計
- **主要ライブラリ**:
  - `@line/bot-sdk`: ^9.3.0
  - `@supabase/supabase-js`: ^2.39.0
  - `@upstash/redis`: ^1.25.0
  - `googleapis`: ^128.0.0
  - `openai`: ^4.20.1

---

## 📍 プロジェクトの場所

**ワークスペース**: `/Users/nishiyamaakihiro/Desktop/safereply-node`

**リポジトリ**: `https://github.com/aki6517/safe-replay.git`

**設計ドキュメント**: `/Users/nishiyamaakihiro/Documents/`
- `01_requirements.md` - 要件定義書
- `02_architecture.md` - アーキテクチャ設計書
- `03_database.md` - データベース設計書
- `04_api.md` - API設計書
- `05_sitemap.md` - サイトマップ・画面設計書

---

## ✅ 完了した作業（進捗状況）

### フェーズ1: Walking Skeleton（進行中）

- ✅ **Issue #1**: プロジェクト初期化・環境構築
  - `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`作成完了
  - 開発サーバー起動確認済み

- ✅ **Issue #2**: Supabaseデータベース構築
  - `supabase/migrations/001_initial_schema.sql`作成完了
  - 全テーブル、インデックス、RLSポリシー設定済み

- ✅ **Issue #3**: Supabase・Redisクライアント設定
  - `src/db/client.ts` - Supabaseクライアント実装完了
  - `src/db/redis.ts` - Upstash Redisクライアント実装完了
  - `src/types/database.ts` - 型定義作成完了

- ✅ **Issue #4**: 基本APIエンドポイント実装
  - `src/index.ts` - Honoアプリケーション初期化完了
  - ルーティング構造構築済み（`/api/v1/line`, `/api/v1/poll`, `/api/v1/health`）
  - ミドルウェア設定済み（logger, cors, prettyJSON）

- ✅ **Issue #5**: ヘルスチェックAPI実装
  - `GET /api/v1/health` - シンプルな生存確認実装完了
  - `GET /api/v1/health/deep` - DB・Redis接続確認実装完了
  - Service Key認証実装済み

- ⚠️ **Issue #6**: Railwayデプロイ設定（一部完了）
  - ✅ `railway.toml`作成完了
  - ⏳ Railwayプロジェクト作成（手作業が必要）
  - ⏳ GitHubリポジトリ連携（手作業が必要）
  - ⏳ 環境変数設定（手作業が必要）

- ✅ **Issue #7**: GitHub Actions基本ワークフロー作成（完了）
  - ✅ `.github/workflows/poll.yml`作成済み（5分間隔ポーリング）
  - ✅ `.github/workflows/health.yml`作成済み（15分間隔ヘルスチェック）
  - ✅ `.github/workflows/deploy.yml`作成済み（CIワークフロー）
  - ✅ GitHub Secrets設定完了（`API_BASE_URL`、`SERVICE_KEY`）
  - ✅ ワークフローが正常に動作することを確認

- ✅ **Issue #8**: LINE Webhook基本実装（完了）
  - ✅ `POST /api/v1/line/webhook`エンドポイントを実装
  - ✅ LINE署名検証ロジックを実装
  - ✅ イベントタイプ（message, postback, follow, unfollow）のルーティング
  - ✅ 型定義を追加（`src/types/line-webhook.ts`）
  - ✅ エラーハンドリングを実装
  - ✅ Webhook URL設定完了、テストメッセージ送受信確認完了

- ✅ **Issue #9**: LINE Bot基本応答実装（完了）
  - ✅ テキストメッセージ送信関数を実装（`sendTextMessage`, `replyTextMessage`）
  - ✅ followイベント時のウェルカムメッセージを実装
  - ✅ エラーハンドリングを実装
  - ✅ Railwayログでメッセージ送信成功を確認
  - ✅ LINEアプリでウェルカムメッセージの表示を確認

---

## 🎯 次の作業

### Issue #10: Gmail API連携

**ファイル**: `docs/issues/10-gmail-api-integration.md`

**概要**: Gmail APIを使用して未読メールを取得する機能を実装

**依存**: Issue #3, #4

**ラベル**: `backend`, `gmail`

---

## 📁 重要なファイル・ディレクトリ

### プロジェクトルール
- **`docs/PROJECT-RULES.md`** - 🔴 **必ず参照すること**
  - コミットメッセージ規約
  - コードスタイルルール
  - セキュリティルール
  - AIアシスタント向け作業プロセス
  - **重要**: このファイルを参照したら、ファイル名を発言すること

### 実装計画
- **`docs/IMPLEMENTATION-PLAN.md`** - 全28Issueの詳細
- **`docs/issues/*.md`** - 各Issueの詳細仕様

### 既存の実装ファイル
- `src/index.ts` - メインアプリケーション
- `src/routes/health.ts` - ヘルスチェックAPI
- `src/routes/line-webhook.ts` - LINE Webhook（スケルトン）
- `src/routes/poll.ts` - ポーリングAPI（スケルトン）
- `src/db/client.ts` - Supabaseクライアント
- `src/db/redis.ts` - Redisクライアント
- `src/types/database.ts` - データベース型定義

### 設定ファイル
- `package.json` - 依存関係・スクリプト
- `tsconfig.json` - TypeScript設定
- `railway.toml` - Railwayデプロイ設定
- `.env.example` - 環境変数テンプレート

### GitHub Actions
- `.github/workflows/poll.yml` - ポーリングワークフロー（作成済み）
- `.github/workflows/health.yml` - ヘルスチェックワークフロー（作成済み）
- `.github/workflows/deploy.yml` - **未作成**

---

## 🔐 環境変数（`.env.example`参照）

必要な環境変数:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `OPENAI_API_KEY`
- `SERVICE_KEY`（ヘルスチェック認証用）
- `PORT`（デフォルト: 3000）

---

## 📝 作業時の注意事項

### 必須ルール（`PROJECT-RULES.md`参照）

1. **コミット確認**: 1作業項目完了ごとにコミット確認を求める
2. **エラー記録**: エラー発生時は原因と改善対応を記録
3. **タスク中断**: 5分以上進行しない場合は中断して報告
4. **重複実装防止**: 実装前に既存機能を確認
5. **設計書参照**: 実装前に`docs/`配下の設計書を確認
6. **明示的指示外の変更禁止**: UI/UX、技術スタックの変更は禁止

### コミットメッセージ規約

```
<type>: <subject>

[optional body]

Closes #<issue_number>
```

**Type**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**例**:
```
feat: GitHub Actions自動デプロイワークフロー追加

- deploy.ymlを作成
- Railwayへの自動デプロイを設定
- 環境変数の検証を追加

Closes #7
```

---

## 🚀 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番起動
npm start

# 型チェック
npm run type-check

# Lint
npm run lint

# フォーマット
npm run format
```

---

## 📊 実装計画の全体像

### フェーズ1: Walking Skeleton（#1〜#7）
- ✅ #1: プロジェクト初期化
- ✅ #2: データベース構築
- ✅ #3: DBクライアント設定
- ✅ #4: 基本APIエンドポイント
- ✅ #5: ヘルスチェックAPI
- ⚠️ #6: Railwayデプロイ設定（一部完了）
- 🔄 #7: GitHub Actionsワークフロー（進行中）

### フェーズ2: コア機能実装（#8〜#18）
- Gmail/Chatwork API連携
- ファイル解析（PDF/DOCX/XLSX/PPTX）
- AI Engine（Model Agnostic）
- AIトリアージ・ドラフト生成
- LINE通知・Flex Message

### フェーズ3: 自動化（#19〜#23）
- ポーリング自動化
- LINE転送メッセージ処理

### フェーズ4: 堅牢化（#24〜#28）
- セキュリティ強化
- エラーハンドリング
- 緊急通知機能

---

## 🎯 次のステップ

1. **`PROJECT-RULES.md`を参照**して、ルールを確認
2. **Issue #7の残り作業を完了**:
   - `.github/workflows/deploy.yml`を作成
   - GitHub Secretsの設定手順を確認
3. **Issue #7完了後、Issue #8に進む**（Gmail API連携）

---

## 📞 不明点・確認事項

- Railwayプロジェクトの作成状況（Issue #6の手作業部分）
- GitHub Secretsの設定状況
- 次のIssueへの移行タイミング

---

**最終更新**: 2025-01-XX  
**現在の進捗**: Issue #7進行中（フェーズ1: Walking Skeleton）


