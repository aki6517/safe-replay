# SafeReply SaaS化 実装計画書

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SafeReplyを商用SaaS（Free/Proプラン、Stripe課金、セキュリティ強化済み）としてリリースできる状態にする

**Architecture:** Supabase Edge Functions (Deno) + PostgreSQL + Upstash Redis。Hono フレームワークで全APIを提供。LINE Botを主要UIとし、LIFFでオンボーディング。AIはOpenAI nano/mini の2モデル構成。

**Tech Stack:** TypeScript, Hono, Supabase (Edge Functions/PostgreSQL/Cron/Vault), Upstash Redis, OpenAI API, LINE Messaging API, Stripe

**Specs:** `docs/superpowers/specs/2026-03-23-*.md` （要件定義書、アーキテクチャ、DB、API、セキュリティ、運用）

---

## フェーズ構成

| フェーズ | 内容 | 依存 |
|---------|------|------|
| **A. セキュリティ修正（P0）** | LIFF認証、XSS修正 | なし |
| **B. 新機能実装** | VIPリスト、スヌーズ、テンプレート、スレッド文脈 | なし |
| **C. 課金基盤** | Stripe統合、レートリミット、月次カウンター | A完了後 |
| **D. 運用基盤** | データクリーンアップ、アカウント削除、利用規約 | A完了後 |
| **E. AIモデル更新** | nano/mini 2モデル構成への切り替え | なし |
| **F. リリース準備** | LP、最終テスト、本番設定 | A-E完了後 |

---

## フェーズA: セキュリティ修正（P0）

### Task A-1: LIFFエラーページのXSS修正

**Files:**
- Modify: `src/routes/liff.ts` — エラーページのHTML出力部分

- [ ] **Step 1: XSS脆弱箇所を特定**
  `src/routes/liff.ts`内で`reason`クエリパラメータを直接HTMLに挿入している箇所を検索。

- [ ] **Step 2: エスケープ関数を追加**
  ```typescript
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```

- [ ] **Step 3: エラーページのHTML出力でエスケープ適用**
  `${reason}` → `${escapeHtml(reason)}` に置換。

- [ ] **Step 4: コミット**
  ```bash
  git add src/routes/liff.ts
  git commit -m "fix: LIFFエラーページのXSS脆弱性を修正"
  ```

---

### Task A-2: LIFF ID Token検証

**Files:**
- Create: `src/utils/liff-auth.ts` — ID Token検証ユーティリティ
- Modify: `src/routes/user-api.ts` — 全エンドポイントに認証追加

- [ ] **Step 1: LIFF ID Token検証関数を作成**
  ```typescript
  // src/utils/liff-auth.ts
  export async function verifyLiffIdToken(idToken: string): Promise<string | null> {
    const channelId = process.env.LIFF_CHANNEL_ID || process.env.LINE_CHANNEL_ID;
    if (!channelId) return null;

    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.sub || null; // sub = LINE User ID
  }
  ```

- [ ] **Step 2: user-api.tsの全エンドポイントにID Token検証を追加**
  リクエストヘッダー`Authorization: Bearer <ID_TOKEN>`からトークンを取得し、`verifyLiffIdToken()`で検証。検証成功時のline_user_idをリクエストボディのlineUserIdの代わりに使用。フォールバック: トークンなしの場合は従来通りlineUserIdを使用（後方互換、開発時のみ）。

- [ ] **Step 3: コミット**
  ```bash
  git add src/utils/liff-auth.ts src/routes/user-api.ts
  git commit -m "feat: LIFF ID Token検証を追加（ユーザーAPI認証強化）"
  ```

---

### Task A-3: LINE Webhookタイムスタンプ検証

**Files:**
- Modify: `src/routes/line-webhook.ts` — タイムスタンプ検証追加

- [ ] **Step 1: Webhookイベントのtimestampを検証**
  イベントのtimestampが現在時刻から5分以上古い場合はリプレイ攻撃として拒否。

- [ ] **Step 2: コミット**
  ```bash
  git add src/routes/line-webhook.ts
  git commit -m "fix: LINE Webhookにタイムスタンプ検証を追加（リプレイ攻撃防止）"
  ```

---

## フェーズB: 新機能実装

### Task B-1: VIPリスト

**Files:**
- Create: `supabase/migrations/009_vip_entries.sql`
- Create: `src/services/vip-list.ts` — VIPリスト管理サービス
- Modify: `src/routes/line-webhook.ts` — 「VIP追加/削除」コマンド処理
- Modify: `src/services/poller/gmail-multi.ts` — VIP送信者のType A強制

- [ ] **Step 1: マイグレーション作成**
  ```sql
  CREATE TABLE IF NOT EXISTS vip_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_identifier TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, sender_identifier)
  );
  ALTER TABLE vip_entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Service role full access on vip_entries"
    ON vip_entries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  ```

- [ ] **Step 2: VIPリストサービス作成**
  `addVip(userId, senderIdentifier)`, `removeVip(userId, senderIdentifier)`, `isVip(userId, senderIdentifier)`, `listVips(userId)` を実装。

- [ ] **Step 3: LINE Botコマンド処理追加**
  line-webhook.tsのメッセージ処理で「VIP追加 xxx@yyy.com」「VIP削除 xxx@yyy.com」「VIP一覧」を検知し、vip-list.tsの関数を呼び出す。

- [ ] **Step 4: ポーリングでVIPチェック追加**
  gmail-multi.tsのトリアージ結果判定前に`isVip()`を確認。VIPならType Aに強制。

- [ ] **Step 5: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git add supabase/migrations/009_vip_entries.sql src/services/vip-list.ts src/routes/line-webhook.ts src/services/poller/gmail-multi.ts
  git commit -m "feat: VIPリスト機能を追加（F-13）"
  ```

---

### Task B-2: スヌーズ機能

**Files:**
- Create: `supabase/migrations/010_snooze.sql` — snooze_until列追加
- Create: `src/services/snooze.ts` — スヌーズ管理
- Modify: `src/services/flex-messages/type-a.ts` — [後で対応]ボタン追加
- Modify: `src/services/action-handler.ts` — snoozeアクション処理
- Modify: `src/services/poller/gmail-multi.ts` — スヌーズ済みメッセージのリマインド

- [ ] **Step 1: マイグレーション**
  ```sql
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_messages_snooze ON messages(snooze_until) WHERE snooze_until IS NOT NULL;
  ```

- [ ] **Step 2: スヌーズサービス作成**
  `snoozeMessage(messageId, durationMinutes)` — status='snoozed', snooze_until設定。
  `getExpiredSnoozes()` — snooze_until < now() のメッセージを取得。

- [ ] **Step 3: Flex Messageに[後で対応]ボタン追加**
  type-a.tsのボタン行に`action=snooze&message_id={id}&duration=120`（2時間後）ボタンを追加。

- [ ] **Step 4: action-handlerにsnooze処理追加**
  postbackデータ`action=snooze`を処理。durationパラメータで時間を設定。

- [ ] **Step 5: ポーリングにスヌーズリマインド追加**
  ポーリング時に`getExpiredSnoozes()`を呼び、期限切れスヌーズをLINE再通知。

- [ ] **Step 6: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git commit -m "feat: スヌーズ機能を追加（F-11）"
  ```

---

### Task B-3: 返信テンプレート

**Files:**
- Create: `supabase/migrations/011_reply_templates.sql`
- Create: `src/services/templates.ts` — テンプレート管理
- Modify: `src/routes/line-webhook.ts` — テンプレートコマンド処理

- [ ] **Step 1: マイグレーション**
  ```sql
  CREATE TABLE IF NOT EXISTS reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
  );
  ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Service role full access on reply_templates"
    ON reply_templates FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  ```

- [ ] **Step 2: テンプレートサービス作成**
  `saveTemplate(userId, name, content)`, `getTemplate(userId, name)`, `listTemplates(userId)`, `deleteTemplate(userId, name)`, `countTemplates(userId)` を実装。Freeプランは3件制限。

- [ ] **Step 3: LINE Botコマンド処理**
  「テンプレ保存 名前 内容」「テンプレ一覧」「テンプレ削除 名前」「テンプレ使用 名前」コマンドを処理。

- [ ] **Step 4: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git commit -m "feat: 返信テンプレート機能を追加（F-12）"
  ```

---

### Task B-4: スレッド文脈の完全統合

**Files:**
- Modify: `src/services/poller/gmail-multi.ts` — スレッド履歴取得を確実に実装
- Modify: `src/ai/draft.ts` — threadHistoryの受け渡し確認

- [ ] **Step 1: gmail-multi.tsでスレッド履歴を取得してAIに渡す**
  `getThreadHistory()`を呼び出し、`triageMessage()`と`generateDraft()`の`context`引数に渡す。

- [ ] **Step 2: 動作確認 + コミット**
  ```bash
  git commit -m "fix: スレッド文脈をAIドラフト生成に確実に反映（F-14）"
  ```

---

## フェーズC: 課金基盤

### Task C-1: Stripe統合

**Files:**
- Create: `supabase/migrations/012_stripe_fields.sql`
- Create: `src/services/billing.ts` — Stripe連携サービス
- Create: `src/routes/stripe-webhook.ts` — Stripe Webhookハンドラ
- Modify: `src/app.ts` — ルート追加
- Modify: `package.json` — stripe依存追加

- [ ] **Step 1: Stripe依存追加**
  ```bash
  npm install stripe
  ```

- [ ] **Step 2: マイグレーション**
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
  CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
  ```

- [ ] **Step 3: billing.ts作成**
  `createCheckoutSession(lineUserId)` — Stripe Checkout URLを生成。
  `handleSubscriptionUpdate(event)` — Webhook処理（plan_type更新）。
  `getSubscriptionStatus(lineUserId)` — 現在のプラン状態取得。

- [ ] **Step 4: Stripe Webhookルート作成**
  `POST /api/v1/stripe/webhook` — Stripeの署名検証 + イベント処理。
  対象イベント: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`。

- [ ] **Step 5: app.tsにルート追加**

- [ ] **Step 6: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git commit -m "feat: Stripe決済統合（F-B1）"
  ```

---

### Task C-2: プラン別レートリミット

**Files:**
- Modify: `src/services/poller/gmail-multi.ts` — Freeプラン5件制限
- Modify: `src/services/poller/chatwork.ts` — Proプランチェック
- Create: `src/services/plan-guard.ts` — プラン制限チェックユーティリティ

- [ ] **Step 1: plan-guard.ts作成**
  `canProcessMessage(userId)` — plan_typeとmessage_count_monthを確認。Free && count >= 5 なら false。
  `incrementMessageCount(userId)` — カウントインクリメント。

- [ ] **Step 2: ポーリングにレートリミット追加**
  gmail-multi.tsの各メッセージ処理前に`canProcessMessage()`を呼ぶ。
  falseの場合はスキップ + 初回のみLINE通知「今月の無料枠を使い切りました」。

- [ ] **Step 3: Chatwork/SlackをProプラン限定に**
  chatwork.tsとslack処理でplan_type確認。Free → スキップ。

- [ ] **Step 4: コミット**
  ```bash
  git commit -m "feat: プラン別レートリミットを実装（F-B2, F-B3）"
  ```

---

### Task C-3: 月次カウンターリセットCron

**Files:**
- Create: `supabase/migrations/013_month_reset_cron.sql`

- [ ] **Step 1: pg_cronジョブ作成**
  ```sql
  SELECT cron.schedule(
    'safereply_month_reset',
    '0 0 1 * *',
    $$UPDATE users SET message_count_month = 0, month_reset_at = now()$$
  );
  ```

- [ ] **Step 2: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git commit -m "feat: 月次カウンターリセットCronを追加（F-B3）"
  ```

---

## フェーズD: 運用基盤

### Task D-1: データ自動クリーンアップ

**Files:**
- Create: `supabase/migrations/014_data_cleanup_cron.sql`

- [ ] **Step 1: pg_cronジョブ作成**
  ```sql
  SELECT cron.schedule(
    'safereply_data_cleanup',
    '0 3 * * *',
    $$
    DELETE FROM messages WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM message_actions WHERE created_at < NOW() - INTERVAL '1 year';
    DELETE FROM usage_logs WHERE created_at < NOW() - INTERVAL '1 year';
    $$
  );
  ```

- [ ] **Step 2: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git commit -m "feat: データ自動クリーンアップCronを追加（F-B6）"
  ```

---

### Task D-2: アカウント削除機能

**Files:**
- Create: `src/services/account.ts` — アカウント削除サービス
- Modify: `src/routes/line-webhook.ts` — 「アカウント削除」コマンド
- Modify: `src/routes/user-api.ts` — DELETE /api/user/account エンドポイント

- [ ] **Step 1: account.ts作成**
  `deleteAccount(lineUserId)` — セキュリティ設計書4.4のフローに従い全データ削除。Redis キーも削除。

- [ ] **Step 2: LINE Botで「アカウント削除」コマンド処理**
  確認メッセージ送信 → 「はい」で削除実行。

- [ ] **Step 3: user-apiにDELETEエンドポイント追加**

- [ ] **Step 4: コミット**
  ```bash
  git commit -m "feat: アカウント削除機能を追加（F-B5）"
  ```

---

### Task D-3: 利用規約・プライバシーポリシー同意ゲート

**Files:**
- Modify: `src/routes/liff.ts` — オンボーディング画面に同意ステップ追加
- Create: `supabase/migrations/015_tos_acceptance.sql` — 同意日時カラム

- [ ] **Step 1: マイグレーション**
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
  ```

- [ ] **Step 2: LIFF画面の最初に同意ゲートを表示**
  利用規約・プライバシーポリシーへのリンク + 「同意して始める」ボタン。同意なしではGmail連携に進めない。

- [ ] **Step 3: 同意をDBに記録**
  `/api/user/accept-tos`エンドポイント追加。`tos_accepted_at`を記録。

- [ ] **Step 4: マイグレーション実行 + コミット**
  ```bash
  supabase db push
  git commit -m "feat: 利用規約・プライバシーポリシー同意ゲートを追加（F-O2）"
  ```

---

## フェーズE: AIモデル更新

### Task E-1: nano/mini 2モデル構成

**Files:**
- Modify: `src/ai/openai.ts` — モデル切り替えロジック
- Modify: `src/ai/triage.ts` — nanoモデル指定
- Modify: `src/ai/soften.ts` — nanoモデル指定
- Modify: `src/ai/draft.ts` — miniモデル指定

- [ ] **Step 1: OpenAIProviderにモデル切替機能追加**
  `callAPI()`に`model`パラメータを追加。デフォルトはmini、トリアージ/柔軟化はnano。

- [ ] **Step 2: 環境変数でモデル名を設定可能に**
  `OPENAI_MODEL_NANO`（デフォルト: gpt-5.4-nano → フォールバック: gpt-4o-mini）
  `OPENAI_MODEL_MINI`（デフォルト: gpt-5.4-mini → フォールバック: gpt-4o-mini）

- [ ] **Step 3: コミット**
  ```bash
  git commit -m "feat: AIモデルをnano/mini 2モデル構成に変更"
  ```

---

## フェーズF: リリース準備

### Task F-1: LP（ランディングページ）作成

- [ ] 別リポジトリまたはLIFF内で作成（詳細は別途計画）

### Task F-2: 利用規約・プライバシーポリシー・特商法表記の文書作成

- [ ] 法的文書のドラフト作成（詳細は別途計画）

### Task F-3: 本番環境設定

- [ ] Stripe本番キーの設定
- [ ] LINE Messaging API Light/Standardプランへの移行
- [ ] Supabase Proプランの検討（ユーザー数に応じて）
- [ ] 全環境変数の最終確認

### Task F-4: E2Eテスト

- [ ] 新規ユーザー登録→Gmail連携→メール受信→通知→返信の全フロー
- [ ] Freeプラン上限到達→アップグレード案内
- [ ] スヌーズ→リマインド
- [ ] VIP登録→Type A強制通知
- [ ] アカウント削除→全データ消去確認

---

## 実装順序サマリー

```
A-1 XSS修正 (30分)
A-2 LIFF認証 (2時間)
A-3 タイムスタンプ検証 (1時間)
    ↓
B-1 VIPリスト (3時間)     ←─── 並行可能
B-2 スヌーズ (3時間)       ←─── 並行可能
B-3 テンプレート (2時間)   ←─── 並行可能
B-4 スレッド文脈 (1時間)   ←─── 並行可能
    ↓
C-1 Stripe統合 (4時間)
C-2 レートリミット (2時間)
C-3 月次リセットCron (30分)
    ↓
D-1 データクリーンアップ (30分)
D-2 アカウント削除 (2時間)
D-3 利用規約同意ゲート (2時間)
    ↓
E-1 AIモデル更新 (1時間)
    ↓
F-1〜F-4 リリース準備
```

**総見積もり: 約24時間（コーディング作業のみ）**
