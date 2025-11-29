# Supabase API Keys移行記録

## 📅 実施日
2025年11月29日

## 🎯 目的
GitHub Secret Scanningアラートで検出された漏洩したSupabase API Keysを新しいAPI Keysシステムに移行し、セキュリティを強化する。

## 🔍 問題の背景

### GitHub Secret Scanningアラート
- **検出日**: 2025年11月29日
- **検出されたシークレット**:
  1. OpenAI API Key (`.env.example:38`) - 9時間前に開かれた
  2. Supabase Service Role Key (`.env.example:9`) - 2日前に開かれた

### 原因
過去のコミット履歴に実際のシークレットが含まれていた（`.env.example`ファイルに実際のキーが含まれていた）。

## ✅ 実施した対応

### 1. Supabase API Keysの移行

#### Legacy API Keys → 新しいAPI Keys

| キー種別 | Legacy形式 | 新しい形式 | 状態 |
|---------|-----------|-----------|------|
| Service Role Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT) | `sb_secret_...` | ✅ 移行完了 |
| Anon Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT) | `sb_publishable_...` | ✅ 移行完了 |

#### 移行手順

1. **Supabaseダッシュボードで新しいキーを生成**
   - Settings → API → 「Publishable and secret API keys」タブ
   - Secret Keyを作成（`sb_secret_...`形式）
   - Publishable Keyをコピー（`sb_publishable_...`形式）

2. **`.env`ファイルを更新**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...（新しいSecret Key）
   SUPABASE_ANON_KEY=sb_publishable_...（新しいPublishable Key）
   ```

3. **コードの変更は不要**
   - 既存のコードは新しいキー形式でもそのまま動作
   - `src/db/client.ts`の変更は不要

### 2. 動作確認

#### 確認項目
- ✅ Supabaseクライアントの初期化
- ✅ データベース接続
- ✅ メッセージテーブルへのアクセス
- ✅ LINE通知サービスの動作

#### テスト結果
```bash
# Supabaseキー動作確認
✅ 新しいSecret Key形式: sb_secret_...
✅ 新しいPublishable Key形式: sb_publishable_...
✅ データベース接続成功
✅ メッセージテーブルへのアクセス成功

# LINE通知サービステスト
✅ Type A通知: 成功（Flex Message）
✅ Type B通知: 成功
✅ Type C通知: スキップ（正常）
```

## 📚 参考資料

- [Supabase API Keys移行ガイド](https://github.com/orgs/supabase/discussions/29260)
- Supabaseダッシュボード: Settings → API → 「Publishable and secret API keys」

## 🔐 セキュリティベストプラクティス

### ✅ 実施済み
- [x] 漏洩したキーを新しいキーに置き換え
- [x] 新しいAPI Keysシステムに移行
- [x] `.env.example`はプレースホルダーのみ（実際のキーは含まない）
- [x] `.env`ファイルは`.gitignore`に追加済み

### 📋 今後の対応
- [ ] GitHubのSecret Scanningアラートを「解決済み」としてマーク
- [ ] SupabaseダッシュボードでLegacy keysを無効化（オプション）
- [ ] 定期的なセキュリティ監査の実施

## 🎓 学んだこと

1. **Git履歴に含まれたシークレットは完全に削除できない**
   - 新しいキーに置き換えることで、影響を最小限に抑える
   - 将来的には、`.env.example`には常にプレースホルダーのみを含める

2. **Supabaseの新しいAPI Keysシステム**
   - Legacy keys（JWT形式）から新しいkeys（`sb_`形式）への移行が推奨されている
   - 2025年11月以降、新規プロジェクトではLegacy keysが利用不可になる予定
   - 新しいkeysは複数作成可能で、個別に無効化・再生成が可能

3. **コードの互換性**
   - 新しいkeysは既存のコードでそのまま使用可能
   - 環境変数名は変更不要

## 📝 関連ファイル

- `.env` - 実際のキー（gitignore対象）
- `.env.example` - プレースホルダーのみ
- `src/db/client.ts` - Supabaseクライアント初期化
- `scripts/test-supabase-keys.ts` - キー動作確認スクリプト

---

**最終更新**: 2025年11月29日

