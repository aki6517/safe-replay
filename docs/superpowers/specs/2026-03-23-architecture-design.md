# SafeReply アーキテクチャ設計書

> Version: 1.0
> Date: 2026-03-23
> Status: Draft
> 前提: [要件定義書](2026-03-23-safereply-saas-requirements.md)

---

## 1. システム概要

SafeReplyは、Supabase Edge Functions上で動作するサーバーレスアプリケーション。
Hono（軽量HTTPフレームワーク）でAPIを提供し、外部サービス（Gmail/Chatwork/Slack/LINE/OpenAI）と連携する。

### 1.1 システム構成図

```
                    ┌─────────────────────────────────────┐
                    │          Supabase Platform           │
                    │                                     │
  [Gmail API] ◄────┤  ┌─────────────────────────────┐    │
  [Chatwork API]◄──┤  │   Edge Functions (Deno)     │    │
  [Slack API] ◄────┤  │   ┌─────────────────────┐   │    │
  [OpenAI API] ◄───┤  │   │  Hono App (app.ts)  │   │    │
  [LINE API] ◄─────┤  │   │  ├─ /api/v1/line/*  │   │    │
                    │  │   │  ├─ /api/v1/poll/*  │   │    │
                    │  │   │  ├─ /api/v1/health  │   │    │
                    │  │   │  ├─ /api/slack/*    │   │    │
                    │  │   │  ├─ /api/user/*     │   │    │
                    │  │   │  ├─ /api/oauth/*    │   │    │
                    │  │   │  └─ /liff/*         │   │    │
                    │  │   └─────────────────────┘   │    │
                    │  └─────────────────────────────┘    │
                    │                                     │
                    │  ┌──────────────┐ ┌──────────────┐  │
                    │  │ PostgreSQL   │ │ Supabase Cron│  │
                    │  │ + RLS        │ │ (5分間隔)    │  │
                    │  └──────────────┘ └──────────────┘  │
                    └─────────────────────────────────────┘
                                     │
                    ┌────────────────┘
                    │
               [Upstash Redis]     [GitHub Actions]
               (重複排除キャッシュ)    (CI/CD)
```

### 1.2 テクノロジースタック

| レイヤー | 技術 | 選定理由 |
|----------|------|----------|
| ランタイム | Deno (Supabase Edge Functions) | サーバーレス、コールドスタート高速 |
| フレームワーク | Hono | 軽量、Deno/Node.js両対応、型安全 |
| データベース | Supabase PostgreSQL | RLS標準搭載、マネージド、無料枠充実 |
| キャッシュ | Upstash Redis | サーバーレスRedis、HTTPベース |
| AI | OpenAI API (nano/mini) | 日本語品質高、APIが安定 |
| CI/CD | GitHub Actions | リポジトリ連携、無料枠十分 |

---

## 2. コンポーネント設計

### 2.1 レイヤー構成

```
src/
├─ app.ts              ← エントリポイント（Honoアプリ定義）
├─ routes/             ← プレゼンテーション層（HTTPハンドラ）
│   ├─ line-webhook.ts    LINE Webhook受信
│   ├─ poll.ts            ポーリングAPI
│   ├─ health.ts          ヘルスチェック
│   ├─ slack-events.ts    Slack Events受信
│   ├─ liff.ts            LIFF設定画面（HTML）
│   ├─ user-api.ts        ユーザー管理API
│   ├─ oauth-gmail.ts     Gmail OAuthコールバック
│   └─ oauth-slack.ts     Slack OAuthコールバック
├─ services/           ← ビジネスロジック層
│   ├─ message-processor.ts  メッセージ処理のエントリ
│   ├─ notifier.ts           LINE通知送信
│   ├─ action-handler.ts     アクションボタン処理
│   ├─ edit-mode.ts          編集モード管理
│   ├─ blocklist.ts          ブロックリスト管理
│   ├─ line.ts               LINE API クライアント
│   ├─ gmail.ts              Gmail API クライアント
│   ├─ chatwork.ts           Chatwork API クライアント
│   ├─ slack.ts              Slack API クライアント
│   ├─ poller/
│   │   ├─ gmail-multi.ts    マルチユーザーGmailポーリング
│   │   ├─ gmail.ts          単一ユーザーGmailポーリング
│   │   └─ chatwork.ts       マルチユーザーChatworkポーリング
│   └─ flex-messages/
│       ├─ type-a.ts         Type A通知テンプレート
│       ├─ type-b.ts         Type B通知テンプレート
│       └─ emergency.ts      緊急通知テンプレート
├─ ai/                 ← AI処理層
│   ├─ provider.ts        AIProvider インターフェース
│   ├─ openai.ts          OpenAI実装 + 利用量ログ
│   ├─ triage.ts          トリアージ処理
│   ├─ draft.ts           ドラフト生成処理
│   ├─ soften.ts          ADHD柔軟化処理
│   └─ prompts/index.ts   プロンプトテンプレート
├─ db/                 ← データアクセス層
│   ├─ client.ts          Supabaseクライアント
│   └─ redis.ts           Upstash Redisクライアント
├─ types/              ← 型定義
└─ utils/              ← ユーティリティ
    ├─ security.ts        アクセス制御
    └─ emergency-notification.ts  緊急通知
```

### 2.2 主要データフロー

#### メール受信→通知フロー

```
[Supabase Cron 5分]
    │
    ▼
POST /api/v1/poll/gmail/all
    │
    ▼
getActiveUsers()                  ← DB: status='active', gmail_refresh_token IS NOT NULL
    │
    ▼ (各ユーザーを順次処理)
createGmailClientForUser()        ← ユーザー固有のOAuthトークンでクライアント生成
    │
    ▼
getUnreadMessagesForUser()        ← Gmail API: 直近3日の未読メッセージ取得
    │
    ▼
processedIds.has(messageId)?      ← Redis: 重複チェック（30日TTL）
    │ NO
    ▼
isBlocked(sender)?                ← DB: ブロックリスト確認
    │ NO
    ▼
INSERT INTO messages              ← DB: メッセージ保存
    │
    ▼
triageMessage(subject, body)      ← OpenAI nano: Type A/B/C分類
    │
    ├─ Type A/B ──▶ generateDraft()  ← OpenAI mini: 返信ドラフト生成
    │                    │
    │                    ▼
    │              softenMessage()   ← OpenAI nano: ADHD向け柔軟化
    │                    │
    │                    ▼
    └─────────────▶ sendLineNotification()
                         │
                         ├─ Type A: Flex Message（赤ヘッダー + ドラフト + 5ボタン）
                         ├─ Type B: Flex Message（緑ヘッダー + 既読/確認ボタン）
                         └─ Type C: ログのみ（通知なし）
```

#### アクションボタンフロー

```
[LINE User taps button]
    │
    ▼
POST /api/v1/line/webhook (postback event)
    │
    ▼
handleLineAction(userId, data)
    │
    ├─ action=send     → Gmail/Chatwork API で返信送信 → DB status='sent'
    ├─ action=edit     → Redis: 編集モードON（5分TTL）→ 修正メニュー表示
    ├─ action=dismiss  → DB status='dismissed'
    ├─ action=read     → DB status='read'
    └─ action=acknowledge → Gmail API で確認メール送信
```

---

## 3. 外部サービス統合

| サービス | 認証方式 | 通信方向 | 用途 |
|----------|----------|----------|------|
| Gmail API | OAuth 2.0 (per-user) | Outbound | メール取得・送信 |
| Chatwork API | API Token (per-user) | Outbound | メッセージ取得 |
| Slack API | OAuth 2.0 + Bot Token (per-user) | Both | メッセージ取得・送信 |
| LINE Messaging API | Channel Access Token (global) | Both | Webhook受信・通知送信 |
| OpenAI API | API Key (global) | Outbound | AI処理（トリアージ/ドラフト/柔軟化） |
| Supabase | Service Role Key | Internal | DB・Edge Functions |
| Upstash Redis | REST Token | Outbound | キャッシュ |

---

## 4. セキュリティアーキテクチャ

### 4.1 認証・認可

| エンドポイント | 認証方式 |
|---------------|----------|
| LINE Webhook | HMAC-SHA256署名検証 |
| Slack Events | HMAC-SHA256署名検証 |
| ポーリングAPI | Bearer Token (SERVICE_KEY) |
| LIFF画面 | LIFF SDK（今後: ID Token検証追加） |
| ヘルスチェック(deep) | Bearer Token (SERVICE_KEY) |

### 4.2 データ分離

- 全テーブルにRow Level Security有効化
- 現在のポリシー: `service_role`のみフルアクセス
- バックエンドは全クエリで`user_id`フィルタを必須とする

---

## 5. デプロイメント

### 5.1 CI/CDパイプライン

```
git push main
    │
    ▼
GitHub Actions (deploy.yml)
    ├─ npm ci
    ├─ tsc --noEmit (型チェック)
    ├─ eslint (リント)
    ├─ npm run build
    ├─ npm run sync:edge-source (src/ → supabase/functions/safereply/_src/)
    └─ supabase functions deploy safereply --no-verify-jwt
```

### 5.2 定期実行

| ジョブ | 間隔 | 方式 |
|--------|------|------|
| Gmail/Chatworkポーリング | 5分 | Supabase pg_cron → Edge Function呼出 |
| ヘルスチェック | 15分 | Supabase pg_cron |
| データクリーンアップ | 1日 | Supabase pg_cron（未実装） |

---

## 6. スケーラビリティ考慮

### 6.1 ボトルネック分析

| ユーザー数 | ボトルネック | 対策 |
|-----------|-------------|------|
| ~10人 | なし | 現構成で十分 |
| ~50人 | ポーリング処理時間（5分枠に収まるか） | ユーザー並列処理の検討 |
| ~100人 | LINE API通知数、Supabase Edge呼出数 | Supabase Proプラン移行 |
| 100人+ | アーキテクチャ見直し | キュー導入、ワーカー分離 |
