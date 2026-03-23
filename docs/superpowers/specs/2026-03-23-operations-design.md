# SafeReply 運用設計書

> Version: 1.0
> Date: 2026-03-23
> Status: Draft
> 前提: [要件定義書](2026-03-23-safereply-saas-requirements.md), [セキュリティ設計書](2026-03-23-security-design.md)

---

## 1. 運用方針

SafeReplyは**西山が1人で運用**するSaaS。自動化を最大限活用し、手動オペレーションを最小化する。
「寝ている間も止まらない」「障害に気づける」「復旧手順が明確」を目標とする。

---

## 2. 監視設計

### 2.1 監視項目一覧

| 項目 | 方式 | 間隔 | アラート条件 |
|------|------|------|-------------|
| DB疎通 | `/api/v1/health/deep` | 15分 | 接続失敗 |
| Redis疎通 | `/api/v1/health/deep` | 15分 | 接続失敗 |
| Gmailポーリング | Supabase Cron | 5分 | 3回連続失敗 |
| Chatworkポーリング | Supabase Cron | 5分 | 3回連続失敗 |
| OAuthトークン有効性 | API呼出時の401検知 | リアルタイム | 401エラー発生 |
| AI API利用量 | usage_logs集計 | 日次 | 月間予算の80%超過 |
| Edge Function応答時間 | Supabase Dashboard | 常時 | P95 > 10秒 |

### 2.2 アラート通知

```
障害検知
    │
    ▼
sendEmergencyNotification()
    │
    ├─ 緊急（赤）: DB接続失敗、全ポーリング停止
    ├─ 警告（橙）: OAuthトークン切れ、Redis接続失敗
    └─ 情報（青）: 利用量閾値超過、メンテナンス通知
    │
    ▼
LINE Flex Message → 運営者（西山）のLINE
    │
    ▼
レート制限: 同一障害は1時間に1回まで
```

---

## 3. 定期ジョブ

### 3.1 Supabase Cron ジョブ一覧

| ジョブ名 | 間隔 | 処理内容 | 状態 |
|---------|------|---------|------|
| safereply_poll_gmail | */5 * * * * | 全アクティブユーザーのGmailポーリング | ✅ 稼働中 |
| safereply_poll_chatwork | */5 * * * * | 全アクティブユーザーのChatworkポーリング | ✅ 稼働中 |
| safereply_health_deep | */15 * * * * | DB/Redis疎通確認 | ✅ 稼働中 |
| safereply_data_cleanup | 0 3 * * * (毎日3時) | 90日超メッセージ削除 | ❌ **未実装** |
| safereply_month_reset | 0 0 1 * * (毎月1日) | message_count_monthリセット | ❌ **未実装** |

### 3.2 データクリーンアップ仕様

```sql
-- 90日超のメッセージと関連データを削除
DELETE FROM messages
WHERE created_at < NOW() - INTERVAL '90 days';
-- CASCADE: message_drafts, message_attachments も連動削除
-- message_actions は1年保持のため個別管理

-- 1年超の監査ログを削除
DELETE FROM message_actions
WHERE created_at < NOW() - INTERVAL '1 year';

-- 1年超の利用ログを削除
DELETE FROM usage_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

---

## 4. デプロイ運用

### 4.1 デプロイフロー

```
開発者が main ブランチにpush
    │
    ▼
GitHub Actions (deploy.yml) 自動起動
    ├─ npm ci
    ├─ tsc --noEmit（型チェック）
    ├─ eslint（リント）
    ├─ npm run build
    ├─ npm run sync:edge-source
    └─ supabase functions deploy safereply
    │
    ▼
Supabase Edge Function が即座に更新（ゼロダウンタイム）
```

### 4.2 ロールバック手順

1. `git revert <commit>` で直前のコミットを打ち消し
2. main にpush → 自動デプロイで前のバージョンに戻る
3. DBマイグレーションが含まれる場合は手動で逆マイグレーション実行

### 4.3 DBマイグレーション手順

```bash
# 1. マイグレーションファイル作成
# supabase/migrations/XXX_description.sql

# 2. Supabase CLIでリンク
supabase link --project-ref <ref>

# 3. プッシュ（確認プロンプトあり）
supabase db push

# 4. 失敗時はダッシュボードSQL Editorで手動修正
```

---

## 5. 障害対応手順（ランブック）

### 5.1 Gmail OAuthトークン切れ

**検知**: API呼出時に401 → LINE緊急通知（橙）
**影響**: 該当ユーザーのGmailポーリング停止
**対応**:
1. LINE通知を確認（エラー詳細が記載）
2. 該当ユーザーにLINEで再連携を依頼: 「LIFF設定画面からGmailを再連携してください」
3. ユーザーがLIFFでGmail OAuth再実行 → トークン自動更新
4. 次回ポーリングで復旧確認

### 5.2 Supabase DB接続失敗

**検知**: ヘルスチェック失敗 → LINE緊急通知（赤）
**影響**: 全機能停止
**対応**:
1. Supabase Dashboard でプロジェクト状態を確認
2. Supabase Status Page (status.supabase.com) で障害情報確認
3. Supabase側障害の場合 → 待機。復旧後にヘルスチェック自動再開
4. 自プロジェクト問題の場合 → DB接続設定確認、Supabase再起動

### 5.3 OpenAI API障害

**検知**: AIトリアージ/ドラフト生成失敗 → ログ出力
**影響**: AIドラフト生成不可。メッセージは受信するが返信案なし
**対応**:
1. OpenAI Status Page (status.openai.com) 確認
2. トリアージ失敗時はType Bにフォールバック（実装済み）
3. 一時的にモデルを変更: `OPENAI_MODEL`環境変数を別モデルに設定
4. 復旧後に環境変数を元に戻す

### 5.4 LINE Messaging API障害

**検知**: 通知送信失敗 → ログ出力
**影響**: ユーザーへの通知が届かない（メッセージはDB保存済み）
**対応**:
1. LINE Developer Console でチャネル状態確認
2. LINE Platform Status 確認
3. 復旧後、未通知メッセージの再送は手動対応（DBのstatus='pending'を検索）

### 5.5 ユーザーからの問い合わせ

**経路**: LINE Botへのテキストメッセージ（現在は転送メッセージとして処理される）
**対応**:
1. 「サポート」「問い合わせ」等のキーワードを検知する機能は未実装
2. 初期は手動対応: LINEの管理画面で直接返信
3. 将来: FAQ自動応答 or メールフォーム

---

## 6. コスト管理

### 6.1 月次コスト監視

| 項目 | 監視方法 | 閾値 |
|------|----------|------|
| OpenAI API | usage_logs集計 + OpenAI Dashboard | 月間予算の80% |
| Supabase | Supabase Dashboard | Edge呼出数 or DB容量の80% |
| LINE API | LINE Official Account Manager | 月間通知数の80% |
| Upstash Redis | Upstash Console | 日間コマンド数の80% |

### 6.2 コスト異常検知

```sql
-- 日次コスト集計クエリ（手動実行 or Cron化）
SELECT
  DATE(created_at) as date,
  COUNT(*) as api_calls,
  SUM(tokens_used) as total_tokens,
  SUM(tokens_used) * 0.0000004 as estimated_cost_usd
FROM usage_logs
WHERE service = 'openai'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 6.3 プラン別利用量管理

```
ポーリング時
    │
    ▼
users.message_count_month を確認
    │
    ├─ Free && count >= 5 → 処理スキップ + LINE通知「上限到達」
    ├─ Pro → 制限なし、処理続行
    └─ 処理後 → message_count_month += 1
```

---

## 7. バックアップ・災害復旧

### 7.1 バックアップ

| 対象 | 方式 | 頻度 | 保持期間 |
|------|------|------|----------|
| Supabase DB | Supabase標準バックアップ | 日次 | Free: 7日、Pro: 30日 + PITR |
| ソースコード | GitHub | push時 | 永続 |
| Supabase Secrets | .env.example + Vault | 手動管理 | — |
| Redis | バックアップ不要（キャッシュのみ） | — | — |

### 7.2 復旧手順

| シナリオ | RTO | RPO | 手順 |
|---------|-----|-----|------|
| Edge Function障害 | 5分 | 0 | `git push main` で再デプロイ |
| DBデータ破損 | 4時間 | 24時間 | Supabase Dashboardからバックアップ復元 |
| Supabaseプロジェクト消失 | 1日 | 24時間 | 新プロジェクト作成 + バックアップ復元 + マイグレーション再実行 |
| GitHub障害 | 1時間 | 0 | ローカルリポジトリからpush先変更 |

---

## 8. サポート体制

### 8.1 初期フェーズ（10人規模）

| 項目 | 方針 |
|------|------|
| サポート窓口 | LINE Bot内でのテキスト対応（手動） |
| 対応時間 | 営業日 10:00-18:00 |
| 応答目標 | 24時間以内に初回返信 |
| FAQ | LIFF画面に簡易FAQ掲載 |
| 障害告知 | LINE Botからプッシュ通知 |

### 8.2 スケール時（50人+）

| 項目 | 方針 |
|------|------|
| サポート窓口 | メールフォーム + FAQ自動応答 |
| ステータスページ | Supabase Status連動 or 独自ページ |
| チャットサポート | LINE Bot内で自動応答（AIベース） |

---

## 9. 運用チェックリスト

### 9.1 日次

- [ ] LINE緊急通知の確認（障害通知が来ていないか）
- [ ] Supabase Dashboard で Edge Function エラー率確認

### 9.2 週次

- [ ] usage_logs で各ユーザーの利用量確認
- [ ] OpenAI Dashboard でAPI費用確認
- [ ] Supabase Dashboard でDB容量確認

### 9.3 月次

- [ ] LINE Official Account Manager で通知数確認（プラン超過チェック）
- [ ] 月間コスト集計 → 利益計算
- [ ] message_count_month の自動リセット確認
- [ ] セキュリティアップデート確認（npm audit）

### 9.4 リリース前（必須）

- [ ] 利用規約・プライバシーポリシー作成
- [ ] 特定商取引法に基づく表記作成
- [ ] LIFF ID Token検証の実装
- [ ] OAuthトークン暗号化の実装
- [ ] データクリーンアップCronの設定
- [ ] 月次カウンターリセットCronの設定
- [ ] Stripe決済統合の実装
- [ ] LP（ランディングページ）の作成
