### 背景 / 目的

PPTXファイルからスライドテキストと発表者ノートを抽出する機能を実装し、PowerPointファイル解析を完成させる。

- 依存: #12
- ラベル: `backend`, `parser`

### スコープ / 作業項目

- PPTX解析の実装（pptx-parser使用）
- スライド内テキスト抽出の実装
- **発表者ノート（プレゼンターメモ）抽出の実装**（必須要件）
- 統合インターフェースへの統合

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/parsers/pptx.ts`でPPTX解析を実装（pptx-parser使用）
- [x] スライド内テキスト抽出を実装
- [x] **発表者ノート（プレゼンターメモ）抽出を実装**（必須要件）
- [x] 抽出結果を統合インターフェースで返す
- [x] エラーハンドリングを実装
- [x] PPTX解析をNode.js対応に修正（jszip + xml2js使用）
- [x] テストスクリプトの更新（PPTX対応）
- [x] 発表者ノート付きPPTXファイルで動作確認（完了）

### 実装内容

#### PPTX解析機能

`parsePPTX()`関数で、スライドテキストと発表者ノートの両方を抽出します：

```typescript
import { parsePPTX } from './parsers/pptx';

const result = await parsePPTX(buffer, 10);
// result.text: 全スライドのテキスト
// result.notes: 全スライドの発表者ノート
// result.slides: スライドごとの詳細情報
```

#### 統合インターフェース

`parseFile()`関数で、PPTXファイルも自動判定して解析します：

```typescript
import { parseFile } from './parsers';

const result = await parseFile(buffer, 'presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 10);
// result.text: スライドテキスト
// result.notes: 発表者ノート
// result.slides: スライドごとの詳細情報
// result.pages: スライド数
```

### 動作確認方法

```bash
npm run test-file-parsers ./path/to/sample.pptx
```

### 動作確認結果

**確認日**: 2025-11-29

**テスト結果**:
- ✅ PPTX解析: 成功（7,859文字抽出、35スライド検出）
- ✅ 発表者ノート抽出: 成功（5,628文字抽出）
- ✅ ファイルサイズチェック: 正常動作（10MB制限）
- ✅ ファイル形式自動判定: 正常動作

**テストコマンド**:
```bash
npm run test-file-parsers <ファイルパス>
```

**注意**: `pptx-parser`パッケージはブラウザ専用のため、ZIP/XML直接解析方式（jszip + xml2js）を使用しています。

### テスト観点

- ユニット: PPTXパーサー関数のテスト
- 検証方法: 発表者ノート付きPPTXファイルで、スライドテキストとノートの両方が正しく抽出されることを確認




