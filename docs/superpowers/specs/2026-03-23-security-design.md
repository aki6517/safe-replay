# SafeReply セキュリティ設計書

> Version: 1.0
> Date: 2026-03-23
> Status: Draft
> 前提: [要件定義書](2026-03-23-safereply-saas-requirements.md)

---

## 1. セキュリティ方針

SafeReplyは**ユーザーのメール内容・OAuthトークン**という高感度データを扱うSaaS。
「最小権限」「多層防御」「データ最小化」を原則とし、10人規模でも商用SaaSとして必要なセキュリティを確保する。

---

## 2. 認証設計

### 2.1 エンドポイント別認証マトリクス

| エンドポイント | 認証方式 | 実装状態 |
|---------------|----------|----------|
| POST /api/v1/line/webhook | LINE HMAC-SHA256署名検証 | ✅ 実装済み |
| POST /api/slack/events | Slack HMAC-SHA256署名検証 | ✅ 実装済み |
| POST /api/v1/poll/* | Bearer Token (SERVICE_KEY) | ✅ 実装済み |
| GET /api/v1/health/deep | Bearer Token (SERVICE_KEY) | ✅ 実装済み |
| POST /api/user/* | **LIFF ID Token検証** | ❌ **未実装（要対応）** |
| GET /api/oauth/*/callback | OAuth state パラメータ検証 | ✅ 実装済み |
| GET /api/v1/health | なし（公開） | ✅ 意図的 |
| GET /liff/* | なし（HTML配信） | ✅ 意図的 |

### 2.2 LIFF認証の追加実装（優先度: 高）

**現状の問題**: `/api/user/status`, `/api/user/chatwork`, `/api/user/complete`は`lineUserId`をリクエストボディで受け取るが、検証なし。攻撃者がLINE User IDを知っていれば他人のアカウントを操作可能。

**対策**:
```
1. LIFF SDK: liff.getIDToken() でIDトークンを取得
2. リクエストヘッダーに含める: Authorization: Bearer <ID_TOKEN>
3. サーバー側: LINE Channel IDでIDトークンを検証
4. トークンからline_user_idを抽出して使用（リクエストボディは無視）
```

### 2.3 署名検証の実装詳細

**LINE Webhook**:
- アルゴリズム: HMAC-SHA256
- シークレット: `LINE_CHANNEL_SECRET`
- 対象: リクエストボディ全体
- タイミングセーフ比較: `timingSafeEqual()`実装済み（タイミング攻撃防止）

**Slack Events**:
- アルゴリズム: HMAC-SHA256
- ベース文字列: `v0:{timestamp}:{body}`
- シークレット: `SLACK_SIGNING_SECRET`
- タイムスタンプ検証: リプレイ攻撃防止（5分以内）

---

## 3. 認可設計

### 3.1 データ分離モデル

```
                    ┌─────────────────────────────┐
                    │  Supabase PostgreSQL         │
                    │                             │
                    │  ┌─────────────────────┐    │
                    │  │  RLS Policy         │    │
                    │  │  service_role only   │    │
                    │  └─────────────────────┘    │
                    │            │                │
                    │  ┌─────────┴──────────┐     │
                    │  │ Application Layer  │     │
                    │  │ 全クエリにuser_id  │     │
                    │  │ フィルタを必須     │     │
                    │  └────────────────────┘     │
                    └─────────────────────────────┘
```

- **RLS**: 全テーブルに有効化済み。ポリシーは`service_role`のみフルアクセス
- **アプリケーション層**: Service Role Keyでアクセスするため、コード側で`user_id`フィルタを徹底
- **ルール**: DBクエリでuser_idフィルタがない場合はコードレビューで却下

### 3.2 アクセス制御フロー

```
LINE User → Webhook → isUserAllowedSync(userId)
                              │
                    ┌─────────┴──────────┐
                    │                    │
              DB参照（async版）     環境変数チェック
              users.status         LINE_ALLOWED_USER_IDS
              = 'active'?          に含まれる?
                    │                    │
                    └─────────┬──────────┘
                              │
                    許可 or 拒否（ログ記録）
```

---

## 4. データ保護

### 4.1 機密データ分類

| 分類 | データ | 保存場所 | 現状 | 対策 |
|------|--------|----------|------|------|
| **極秘** | Gmail refresh_token | users表 | 平文 | **Vault暗号化必須** |
| **極秘** | Slack access_token | slack_installations表 | 平文 | **Vault暗号化必須** |
| **極秘** | Chatwork API token | users表 | 平文 | **Vault暗号化必須** |
| **機密** | メール本文 | messages表 | 平文 | DB標準暗号化で可 |
| **機密** | 送信者メールアドレス | messages表 | 平文 | DB標準暗号化で可 |
| **内部** | LINE User ID | users表 | 平文 | 暗号化不要 |
| **内部** | トリアージ結果 | messages表 | 平文 | 暗号化不要 |

### 4.2 トークン暗号化計画（優先度: 高）

**方式**: Supabase Vault（`vault.secrets`テーブル）または `pgp_sym_encrypt`

**対象カラム**:
- `users.gmail_refresh_token`
- `users.gmail_access_token`
- `users.chatwork_api_token`
- `slack_installations.bot_access_token`
- `slack_installations.user_access_token`
- `slack_installations.bot_refresh_token`
- `slack_installations.user_refresh_token`

**既存の参考実装**: migration 003でSupabase Vaultを使用済み（Cronシークレット）

### 4.3 データ保持・削除

| データ | 保持期間 | 削除方式 |
|--------|----------|----------|
| メッセージ・ドラフト | 90日 | Supabase Cronで日次自動削除 |
| 監査ログ（message_actions） | 1年 | メッセージ削除後も保持 |
| 利用ログ（usage_logs） | 1年 | Cronで自動削除 |
| ユーザーデータ | アカウント削除まで | DELETE /api/user/accountで即時削除 |
| OAuthトークン | アカウント削除まで | ユーザー削除時にCASCADE |

### 4.4 アカウント削除フロー

```
ユーザーがLINE BotまたはLIFFから削除要求
    │
    ▼
1. messages, message_drafts, message_attachments → 即時DELETE
2. usage_logs → 即時DELETE
3. blacklist_entries, whitelist_entries → 即時DELETE
4. slack_installations → 即時DELETE
5. users行 → 即時DELETE（CASCADE）
6. Redis: chatwork:processed:{userId}, gmail:processed:{userId} → DEL
7. LINE通知: 「アカウントを削除しました」
```

---

## 5. 通信セキュリティ

| 経路 | プロトコル | 備考 |
|------|----------|------|
| ユーザー ↔ LINE | HTTPS (LINE Platform) | LINE側で管理 |
| LINE ↔ SafeReply | HTTPS + 署名検証 | Edge Functions標準TLS |
| SafeReply ↔ Gmail API | HTTPS + OAuth Bearer | Google API標準 |
| SafeReply ↔ OpenAI API | HTTPS + API Key | OpenAI標準 |
| SafeReply ↔ Supabase DB | 内部接続（同一プラットフォーム） | TLS |
| SafeReply ↔ Upstash Redis | HTTPS (REST API) | Upstash標準 |

---

## 6. 脅威モデル

### 6.1 主要脅威と対策

| 脅威 | 影響 | 対策 | 状態 |
|------|------|------|------|
| LINEユーザーID詐称（LIFF） | 他人のアカウント操作 | LIFF ID Token検証 | ❌ 未実装 |
| OAuthトークン漏洩（DB侵害） | 全ユーザーのメールアクセス | Vault暗号化 | ❌ 未実装 |
| SERVICE_KEY漏洩 | 全API操作可能 | 環境変数管理 + ローテーション | ⚠️ 手動 |
| Webhookリプレイ攻撃 | 不正メッセージ処理 | 署名検証 + タイムスタンプ | ✅（Slack）⚠️（LINE: タイムスタンプ未検証） |
| DDoS（Webhook大量送信） | サービス停止 | Supabase標準レート制限 | ⚠️ 限定的 |
| XSS（LIFFエラーページ） | ユーザーセッション奪取 | 出力エスケープ | ❌ 未実装 |
| OpenAI APIキー漏洩 | 不正利用・課金 | 環境変数管理 + 利用量監視 | ✅ |

### 6.2 対策優先度

| 優先度 | 対策 | 工数目安 |
|--------|------|----------|
| **P0** | LIFF ID Token検証追加 | 2時間 |
| **P0** | LIFFエラーページのXSS修正 | 30分 |
| **P1** | OAuthトークンの暗号化 | 4時間 |
| **P1** | LINE Webhookタイムスタンプ検証追加 | 1時間 |
| **P2** | 構造化ログ導入（console.error → JSON） | 3時間 |
| **P2** | レートリミット（Webhook） | 2時間 |
| **P3** | SERVICE_KEY自動ローテーション | 2時間 |

---

## 7. コンプライアンス

### 7.1 日本国内法規

| 法規 | 対応 |
|------|------|
| 個人情報保護法（APPI） | プライバシーポリシーで利用目的を明示。同意取得をオンボーディングに組込み |
| 電気通信事業法 | 通信の秘密保護。メール内容の取扱いに注意 |
| 特定商取引法 | サブスク提供時は契約条件の明示が必要 |

### 7.2 必要なドキュメント

| ドキュメント | 状態 | 対応 |
|-------------|------|------|
| 利用規約 | ❌ 未作成 | リリース前に作成必須 |
| プライバシーポリシー | ❌ 未作成 | リリース前に作成必須 |
| 特定商取引法に基づく表記 | ❌ 未作成 | 有料プラン提供時に必須 |

---

## 8. インシデント対応

### 8.1 検知手段

| 事象 | 検知方法 | 通知先 |
|------|----------|--------|
| APIトークン切れ | 401エラー検知 → `notifyApiTokenExpired()` | 運営者LINE |
| DB接続失敗 | ヘルスチェック失敗 | 運営者LINE |
| 異常なAPI利用量 | usage_logs月次集計 | 手動確認（将来自動化） |
| 不正アクセス試行 | Webhookログの拒否カウント | 手動確認 |

### 8.2 対応フロー

```
検知 → LINE緊急通知（運営者）
    → 影響範囲特定（どのユーザーか）
    → 一次対応（トークン再発行 or サービス停止）
    → 原因調査
    → 恒久対策
    → ユーザー通知（必要な場合）
```

### 8.3 緊急通知のレート制限

- 同一サービスの通知: **1時間に1回まで**（`NOTIFICATION_COOLDOWN_MS`）
- 通知テンプレート: Flex Message（赤: 緊急、橙: 警告、青: 情報）
