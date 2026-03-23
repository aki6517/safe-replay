# SafeReply データベース設計書

> Version: 1.0
> Date: 2026-03-23
> Status: Draft
> 前提: [要件定義書](2026-03-23-safereply-saas-requirements.md), [アーキテクチャ設計書](2026-03-23-architecture-design.md)

---

## 1. ER図

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    users     │────<│    messages       │────<│ message_drafts   │
│              │     │                  │     │                  │
│ id (PK)      │     │ id (PK)          │     │ id (PK)          │
│ line_user_id │     │ user_id (FK)     │     │ message_id (FK)  │
│ status       │     │ source_type      │     │ draft_content    │
│ plan_type    │     │ triage_type      │     │ tone             │
│ gmail_*      │     │ status           │     │ is_sent          │
│ chatwork_*   │     │ priority_score   │     │ sent_via         │
│ message_count│     └──────────────────┘     └──────────────────┘
└──────────────┘              │
       │                      │
       │               ┌──────┴───────────┐
       │               │                  │
       │     ┌─────────────────┐  ┌──────────────────┐
       │     │message_attachments│  │ message_actions   │
       │     │                 │  │                  │
       │     │ id (PK)         │  │ id (PK)          │
       │     │ message_id (FK) │  │ message_id (FK)  │
       │     │ filename        │  │ action_type      │
       │     │ extracted_text  │  │ triggered_by     │
       │     └─────────────────┘  └──────────────────┘
       │
       ├────<┌──────────────────┐
       │     │ slack_installations│
       │     │                  │
       │     │ id (PK)          │
       │     │ user_id (FK)     │
       │     │ line_user_id (FK)│
       │     │ slack_team_id    │
       │     │ bot_access_token │
       │     │ user_access_token│
       │     └──────────────────┘
       │
       ├────<┌──────────────────┐
       │     │ blacklist_entries │
       │     │ sender_identifier│
       │     │ source_type      │
       │     └──────────────────┘
       │
       ├────<┌──────────────────┐
       │     │  usage_logs      │
       │     │ service          │
       │     │ operation        │
       │     │ tokens_used      │
       │     └──────────────────┘
       │
       └────<┌──────────────────┐
             │ line_edit_modes  │
             │ line_user_id (PK)│
             │ message_id (FK)  │
             │ current_draft    │
             │ expires_at       │
             └──────────────────┘
```

---

## 2. テーブル定義

### 2.1 users（ユーザー）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 内部ID |
| line_user_id | TEXT | UNIQUE, NOT NULL | LINE User ID |
| display_name | TEXT | | 表示名 |
| email | TEXT | | メールアドレス |
| gmail_refresh_token | TEXT | | Gmail OAuthリフレッシュトークン |
| gmail_access_token | TEXT | | Gmail OAuthアクセストークン |
| gmail_token_expires_at | TIMESTAMPTZ | | トークン有効期限 |
| gmail_email | TEXT | | 連携済みGmailアドレス |
| chatwork_api_token | TEXT | | Chatwork APIトークン |
| status | TEXT | DEFAULT 'pending' | pending/active/suspended/deleted |
| activated_at | TIMESTAMPTZ | | 設定完了日時 |
| is_active | BOOLEAN | DEFAULT true | アクティブフラグ |
| last_active_at | TIMESTAMPTZ | | 最終利用日時 |
| plan_type | TEXT | DEFAULT 'free' | free/pro |
| message_count_month | INTEGER | DEFAULT 0 | 今月の処理件数 |
| month_reset_at | TIMESTAMPTZ | DEFAULT now() | 月次カウンターリセット日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新日時（トリガー自動更新） |

**インデックス**: line_user_id, is_active, status, gmail_email

### 2.2 messages（メッセージ）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | UUID | PK | メッセージID |
| user_id | UUID | FK users(id) CASCADE | ユーザーID |
| source_type | TEXT | CHECK IN ('gmail','chatwork','line_forward','slack') | ソース種別 |
| source_message_id | TEXT | | 外部メッセージID |
| thread_id | TEXT | | スレッドID |
| sender_identifier | TEXT | NOT NULL | 送信者識別子 |
| sender_name | TEXT | | 送信者名 |
| subject | TEXT | | 件名 |
| body_plain | TEXT | | プレーンテキスト本文 |
| body_html | TEXT | | HTML本文 |
| extracted_content | TEXT | | 添付ファイル抽出テキスト |
| triage_type | TEXT | CHECK IN ('A','B','C') | AIトリアージ結果 |
| triage_reason | TEXT | | 分類理由 |
| status | TEXT | DEFAULT 'pending', CHECK | pending/notified/sent/dismissed/read/snoozed |
| priority_score | INTEGER | CHECK 0-100 | 優先度スコア |
| draft_reply | TEXT | | 返信ドラフト（簡易保存用） |
| ai_analysis | JSONB | | AI分析結果 |
| metadata | JSONB | DEFAULT '{}' | メタデータ |
| received_at | TIMESTAMPTZ | NOT NULL | 受信日時 |
| notified_at | TIMESTAMPTZ | | LINE通知日時 |
| actioned_at | TIMESTAMPTZ | | アクション実行日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**ユニーク制約**: (user_id, source_type, source_message_id)
**インデックス**: (user_id, status), (user_id, triage_type), (source_type, source_message_id), received_at DESC, thread_id

### 2.3 message_drafts（返信ドラフト）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | UUID | PK | |
| message_id | UUID | FK messages(id) CASCADE | 対象メッセージ |
| draft_content | TEXT | NOT NULL | ドラフト本文 |
| tone | TEXT | DEFAULT 'formal', CHECK | formal/casual/brief |
| version | INTEGER | DEFAULT 1 | バージョン番号 |
| is_selected | BOOLEAN | DEFAULT false | ユーザー選択済み |
| is_sent | BOOLEAN | DEFAULT false | 送信済み |
| sent_via | TEXT | CHECK | gmail/chatwork/slack |
| sent_at | TIMESTAMPTZ | | 送信日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 2.4 message_actions（アクション監査ログ）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | UUID | PK | |
| message_id | UUID | FK messages(id) CASCADE | 対象メッセージ |
| action_type | TEXT | NOT NULL, CHECK | view/send/edit/dismiss/snooze/reopen/forward |
| action_data | JSONB | | アクション固有データ |
| triggered_by | TEXT | DEFAULT 'user', CHECK | user/system/schedule |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**注記**: 監査ログは不可変。メッセージ削除後も1年間保持（要件定義書3.4）。

### 2.5 slack_installations（Slack連携）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK users(id) CASCADE | ユーザーID |
| line_user_id | TEXT | FK users(line_user_id) CASCADE | LINE User ID |
| slack_team_id | TEXT | NOT NULL | ワークスペースID |
| slack_team_name | TEXT | | ワークスペース名 |
| slack_user_id | TEXT | NOT NULL | SlackユーザーID |
| bot_access_token | TEXT | NOT NULL | Botトークン |
| user_access_token | TEXT | NOT NULL | ユーザートークン |
| is_active | BOOLEAN | DEFAULT true | 有効フラグ |
| installed_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**ユニーク制約**: (line_user_id, slack_team_id, slack_user_id)

### 2.6 usage_logs（利用量ログ）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | UUID | PK | |
| user_id | UUID | FK users(id) CASCADE | ユーザーID |
| service | TEXT | NOT NULL | openai/gmail/chatwork/slack |
| operation | TEXT | NOT NULL | triage/draft/soften/send/poll |
| tokens_used | INTEGER | DEFAULT 0 | 使用トークン数 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**インデックス**: user_id, (user_id, created_at)

### 2.7 その他テーブル

| テーブル | 用途 |
|----------|------|
| message_attachments | 添付ファイル管理（filename, mime_type, extracted_text） |
| blacklist_entries | ブロックリスト（sender_identifier + source_type） |
| whitelist_entries | ホワイトリスト（将来拡張用） |
| user_settings | ユーザー設定KVS（setting_key + setting_value JSONB） |
| api_credentials | OAuth認証情報（設計済み・未使用。将来移行先） |
| line_edit_modes | 編集モード状態（line_user_id PK, expires_at付き） |

---

## 3. RLSポリシー

全テーブルに`ENABLE ROW LEVEL SECURITY`が適用済み。

| テーブル | ポリシー |
|----------|---------|
| 全テーブル共通 | `service_role`のみフルアクセス（SELECT/INSERT/UPDATE/DELETE） |

**注記**: アプリケーションはService Role Keyでアクセスするため、RLSを実質バイパス。バックエンドコードで`user_id`フィルタを必須とすることで分離を担保。

---

## 4. マイグレーション履歴

| ファイル | 内容 |
|----------|------|
| 001_initial_schema.sql | コアテーブル（users, messages, drafts, attachments, actions, credentials, settings, whitelist, blacklist）+ RLS + トリガー |
| 002_multi_user_support.sql | usersテーブルにOAuthトークン列追加、status列、activated_at |
| 003_edge_cron_setup.sql | pg_cron設定（Gmail/Chatworkポーリング、ヘルスチェック） |
| 004_line_edit_modes.sql | line_edit_modesテーブル新設 |
| 005_slack_integration.sql | slack_installationsテーブル新設、CHECK制約更新 |
| 006_slack_installations_rls.sql | slack_installationsにRLS有効化 |
| 007_usage_tracking.sql | usage_logsテーブル新設 |
| 008_saas_user_fields.sql | plan_type, message_count_month, month_reset_at追加 |

---

## 5. 今後のマイグレーション計画

| 優先度 | 内容 | 目的 |
|--------|------|------|
| 高 | vip_entriesテーブル新設 | VIPリスト機能（F-13） |
| 高 | reply_templatesテーブル新設 | 返信テンプレート機能（F-12） |
| 高 | snooze関連カラム追加（messages） | スヌーズ機能（F-11） |
| 高 | stripe_customer_id列追加（users） | Stripe課金統合（F-B1） |
| 中 | OAuthトークン暗号化 | セキュリティ要件（pgp_sym_encrypt） |
| 中 | データクリーンアップ用pg_cron | 90日超メッセージ自動削除（F-B6） |
| 低 | api_credentialsテーブルへの移行 | トークン管理の正規化 |
