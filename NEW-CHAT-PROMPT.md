# 新しいチャット開始時のプロンプト

以下のプロンプトを新しいチャットの最初のメッセージとして使用してください。

---

```
SafeReplyプロジェクトの実装を継続します。

## プロジェクト概要
AI自動返信アシスタント「SafeReply」の開発を進めています。
技術スタック: Node.js + TypeScript + Hono + Supabase + Upstash Redis + Railway

## 現在の進捗
- Issue #1〜#7: 完了
- Issue #8: LINE Webhook基本実装（次の作業）

## 重要なファイル
- プロジェクトルール: `docs/PROJECT-RULES.md`（必ず参照すること）
- 実装計画: `docs/IMPLEMENTATION-PLAN.md`
- 引き継ぎ詳細: `docs/CONTEXT-HANDOVER.md`
- 設計ドキュメント: `/Users/nishiyamaakihiro/Documents/01_requirements.md` など

## 次の作業
Issue #8: LINE Webhook基本実装
- `POST /api/v1/line/webhook`エンドポイントの実装
- LINE署名検証ロジックの実装
- イベントタイプ（message, postback, follow, unfollow）のルーティング
- 詳細は `docs/issues/8-line-webhook-basic.md` を参照

## 作業ルール
1. `docs/PROJECT-RULES.md`を必ず参照し、ルールを厳守すること
2. 1作業項目完了ごとにコミット確認を求めること
3. エラー発生時は原因と改善対応を記録すること
4. 実装前に既存機能の重複を確認すること

まず、`docs/PROJECT-RULES.md`を参照して、プロジェクトルールを確認してください。
その後、Issue #7の残り作業を完了させてください。
```

---

**使用方法**: 上記のプロンプトを新しいチャットの最初のメッセージとしてコピー&ペーストしてください。


