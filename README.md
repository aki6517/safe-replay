# SafeReply - AI自動返信アシスタント

ADHD特性による「連絡業務への心理的抵抗感・先延ばし」を解消し、返信遅れによる信用失墜や機会損失を防ぐためのAI自動返信アシスタント。

## 技術スタック

- **バックエンド**: Node.js + TypeScript + Hono
- **データベース**: PostgreSQL (Supabase)
- **キャッシュ**: Redis (Upstash)
- **実行基盤**: Supabase Edge Functions
- **定期実行**: Supabase Cron (`pg_cron` + `pg_net` + Vault)
- **AI**: OpenAI API (GPT-4o-mini) - Model Agnostic設計

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を参考に`.env`ファイルを作成し、必要なAPIキーやトークンを設定してください。

```bash
cp .env.example .env
# .envファイルを編集
```

### 3. データベースマイグレーション

Supabaseのダッシュボードから、`supabase/migrations/*.sql` を順に実行してください。

### 4. Node.js バージョン

```bash
nvm use
```

`.nvmrc`でNode 20系を指定しています。

### 5. 開発サーバーの起動（ポート3001）

```bash
PORT=3001 npm run dev
```

### 6. ヘルスチェック

```bash
curl http://localhost:3001/api/v1/health
```

### 7. 本番ビルド

```bash
npm run build
npm start
```

### 8. Supabase Edge Functions デプロイ

```bash
supabase functions deploy safereply --project-ref <your-project-ref> --no-verify-jwt
```

### 9. Supabase Cron 設定

`supabase/migrations/003_edge_cron_setup.sql` のコメントにある Vault Secret を設定後、`cron.job` / `cron.job_run_details` で稼働を確認してください。

## プロジェクト構造

```
safereply-node/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── app.ts                # 共通Honoアプリ定義（Node/Edge共通）
│   ├── routes/               # APIルート
│   │   ├── line-webhook.ts  # LINE Webhook
│   │   ├── poll.ts          # ポーリングAPI
│   │   └── health.ts        # ヘルスチェック
│   ├── services/             # ビジネスロジック
│   │   ├── gmail.ts         # Gmail API連携
│   │   ├── chatwork.ts      # Chatwork API連携
│   │   ├── line.ts          # LINE Messaging API
│   │   └── poller.ts        # 定期ポーリング
│   ├── ai/                   # AI処理
│   │   ├── provider.ts      # AI Provider Interface
│   │   ├── openai.ts        # OpenAI実装
│   │   ├── triage.ts        # トリアージロジック
│   │   └── prompts/         # プロンプトテンプレート
│   ├── parsers/              # ファイル解析
│   │   ├── index.ts
│   │   ├── pdf.ts
│   │   ├── docx.ts
│   │   ├── xlsx.ts
│   │   └── pptx.ts
│   ├── db/                   # データベース
│   │   ├── client.ts         # Supabase Client
│   │   ├── queries.ts        # DB操作
│   │   └── redis.ts          # Upstash Client
│   ├── utils/                # ユーティリティ
│   │   ├── security.ts       # セキュリティ
│   │   ├── notification.ts   # 緊急通知
│   │   └── logger.ts         # ロガー
│   └── types/                # 型定義
│       ├── message.ts
│       ├── triage.ts
│       └── api.ts
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   └── safereply/
│   │       └── index.ts      # Edge Functions エントリーポイント
│   └── migrations/           # DBマイグレーション
│       ├── 001_initial_schema.sql
│       ├── 002_multi_user_support.sql
│       └── 003_edge_cron_setup.sql
├── .github/
│   └── workflows/            # GitHub Actions
│       ├── deploy.yml        # CI + Supabase Functions Deploy
│       ├── poll.yml          # 手動poll（本番cronはSupabase側）
│       └── health.yml        # 手動health（本番cronはSupabase側）
├── package.json
├── tsconfig.json
└── README.md
```

## APIエンドポイント

- `POST /api/v1/line/webhook` - LINE Webhook受信
- `POST /api/v1/poll/gmail` - Gmailポーリング実行
- `POST /api/v1/poll/chatwork` - Chatworkポーリング実行
- `GET /api/v1/health` - ヘルスチェック
- `GET /api/v1/health/deep` - 詳細ヘルスチェック

詳細は`/Users/nishiyamaakihiro/Documents/04_api.md`を参照してください。

## ライセンス

MIT License



