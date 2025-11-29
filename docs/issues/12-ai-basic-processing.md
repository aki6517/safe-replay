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

- [ ] `src/ai/provider.ts`で`AIProvider`インターフェースを定義
- [ ] `src/ai/openai.ts`で`OpenAIProvider`クラスを実装
- [ ] `src/ai/triage.ts`でトリアージ処理を実装
- [ ] `src/ai/draft.ts`でドラフト生成処理を実装
- [ ] プロンプトテンプレート（`src/ai/prompts/`）を作成
- [ ] レスポンスパース処理を実装
- [ ] エラーハンドリングとリトライロジックを実装
- [ ] テスト用のメッセージで動作確認

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

