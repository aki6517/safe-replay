### 背景 / 目的

OpenAI APIを使用したメッセージのトリアージと返信ドラフト生成機能を実装し、AIによる自動返信の基盤を構築する。

- 依存: #11
- ラベル: `backend`, `ai`

### スコープ / 作業項目

- AI Provider Interfaceの実装（Model Agnostic設計）
- OpenAI Providerの実装
- トリアージ機能の実装（Type A/B/C分類）
- 返信ドラフト生成機能の実装
- プロンプトテンプレートの作成

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/ai/provider.ts`で`AIProvider`インターフェースを定義
- [x] `src/ai/openai.ts`で`OpenAIProvider`クラスを実装
- [x] `src/ai/triage.ts`でトリアージ処理を実装
- [x] `src/ai/draft.ts`でドラフト生成処理を実装
- [x] プロンプトテンプレート（`src/ai/prompts/`）を作成
- [x] レスポンスパース処理を実装
- [x] エラーハンドリングとリトライロジックを実装
- [x] テストスクリプトの作成（`scripts/test-ai-processing.ts`）
- [x] テスト用のメッセージで動作確認（完了）

### テストスクリプト

**動作確認コマンド**:
```bash
npm run test-ai-processing
```

**必要な環境変数**:
- `OPENAI_API_KEY` (必須)
- `OPENAI_MODEL` または `AI_PROVIDER` (オプション、デフォルト: `gpt-4o-mini`)
  - `AI_PROVIDER`が`gpt-`で始まる場合はモデル名として使用されます
  - 例: `AI_PROVIDER=gpt-5.1-2025-11-13`

### 動作確認結果

**確認日**: 2025-11-29

**テスト結果**:
- ✅ 環境変数の設定確認: 成功（`AI_PROVIDER=gpt-5.1-2025-11-13`を使用）
- ✅ OpenAI APIクライアントの初期化: 成功
- ✅ トリアージ処理: 成功（Type A/B/C分類が正しく動作）
- ✅ ドラフト生成処理: 成功（適切な返信ドラフトが生成される）
- ✅ gpt-5系モデル対応: 成功（`max_completion_tokens`を使用）

**テストコマンド**:
```bash
npm run test-ai-processing
```

### テスト観点

- リクエスト: メッセージをAIに送信し、トリアージ結果と返信ドラフトを取得
- 検証方法: テスト用メッセージでトリアージ（A/B/C分類）と返信ドラフト生成が正しく動作することを確認

### 技術仕様

#### トリアージ分類

- **Type A**: 緊急・重要（即座の対応が必要）
- **Type B**: 通常（24時間以内の対応が望ましい）
- **Type C**: 低優先度（後回し可能）

#### AI Provider Interface

```typescript
interface AIProvider {
  triage(subject: string, body: string, context?: string): Promise<TriageResult>;
  generateDraft(subject: string, body: string, triageType: TriageType, context?: string, tone?: string): Promise<string>;
}
```

#### OpenAI実装

- モデル: `gpt-4o-mini`（環境変数で設定可能）
- トリアージ: temperature=0.3（一貫性重視）
- ドラフト生成: temperature=0.7（創造性重視）

