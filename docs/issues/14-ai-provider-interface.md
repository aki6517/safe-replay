### 背景 / 目的

AIプロバイダーに依存しない抽象インターフェースを実装し、Model Agnostic設計の基盤を構築する。

- 依存: #3
- ラベル: `backend`, `ai`

### スコープ / 作業項目

- AIProviderインターフェースの定義
- メソッド定義（triage, generateDraft）
- 環境変数によるプロバイダー切り替え機能
- TypeScript型定義の作成

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `src/ai/provider.ts`で`AIProvider`インターフェースを定義
- [ ] `triage()`と`generateDraft()`メソッドを定義
- [ ] 環境変数でプロバイダーを切り替え可能にする
- [ ] 型定義（`MessageContext`, `TriageResult`等）を作成
- [ ] 将来のGemini/Claude実装を容易にする設計

### テスト観点

- ユニット: インターフェース定義の型チェック
- 検証方法: TypeScriptコンパイルが通ることを確認




