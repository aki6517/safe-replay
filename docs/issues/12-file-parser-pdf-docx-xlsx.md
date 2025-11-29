### 背景 / 目的

PDF、DOCX、XLSXファイルからテキストを抽出する機能を実装し、添付ファイル解析の基盤を構築する。

- 依存: #3
- ラベル: `backend`, `parser`

### スコープ / 作業項目

- PDF解析の実装（pdf-parse使用）
- DOCX解析の実装（mammoth使用）
- XLSX解析の実装（xlsx使用）
- 統合インターフェースの実装
- ファイルサイズ10MB制限の実装

### ゴール / 完了条件（Acceptance Criteria）

- [x] `src/parsers/pdf.ts`でPDF解析を実装（pdf-parse使用）
- [x] `src/parsers/docx.ts`でDOCX解析を実装（mammoth使用）
- [x] `src/parsers/xlsx.ts`でXLSX解析を実装（xlsx使用）
- [x] `src/parsers/index.ts`で統合インターフェースを実装
- [x] ファイルサイズ10MB制限を実装
- [x] エラーハンドリングを実装
- [x] テストスクリプトの作成（`scripts/test-file-parsers.ts`）
- [x] 各形式のサンプルファイルで動作確認（完了）

### 動作確認方法

#### 1. サンプルファイルの準備

以下のいずれかの方法でサンプルファイルを用意してください：

**方法1: 既存のファイルを使用**
- PDF、DOCX、XLSXファイルを任意の場所に配置

**方法2: テスト用ファイルを作成**
- PDF: WordやGoogle Docsで作成した文書をPDFとして保存
- DOCX: Wordで作成した文書をDOCX形式で保存
- XLSX: Excelで作成したスプレッドシートをXLSX形式で保存

#### 2. テストスクリプトの実行

```bash
# PDFファイルのテスト
npm run test-file-parsers ./path/to/sample.pdf

# DOCXファイルのテスト
npm run test-file-parsers ./path/to/sample.docx

# XLSXファイルのテスト
npm run test-file-parsers ./path/to/sample.xlsx
```

#### 3. 確認ポイント

- ✅ ファイル形式が正しく判定される
- ✅ ファイルサイズチェックが動作する
- ✅ テキストが正しく抽出される
- ✅ PDFの場合: メタデータとページ数が取得できる
- ✅ DOCXの場合: HTML形式も取得できる
- ✅ XLSXの場合: シート一覧が取得できる

### 実装内容

#### 統合インターフェース

`parseFile()`関数で、ファイル形式を自動判定して適切なパーサーを呼び出します：

```typescript
import { parseFile } from './parsers';

const result = await parseFile(buffer, 'document.pdf', 'application/pdf', 10);
// result.text: 抽出されたテキスト
// result.metadata: PDFのメタデータ（PDFの場合）
// result.html: HTML形式のテキスト（DOCXの場合）
// result.sheets: シート名のリスト（XLSXの場合）
```

#### サポートされている形式

- **PDF**: `.pdf` - テキストとメタデータを抽出
- **DOCX**: `.docx` - テキストとHTML形式を抽出
- **XLSX**: `.xlsx` - 全シートのデータをテキスト形式で抽出

#### ファイルサイズ制限

デフォルトで10MB制限が適用されます。環境変数`MAX_FILE_SIZE_MB`で変更可能です。

### 動作確認結果

**確認日**: 2025-11-29

**テスト結果**:
- ✅ PDF解析: 成功（7,272文字抽出、メタデータ取得、35ページ検出）
- ✅ DOCX解析: 成功（1,990文字抽出、HTML形式3,854文字取得）
- ✅ XLSX解析: 成功（2,982文字抽出、シート一覧取得）
- ✅ ファイルサイズチェック: 正常動作（10MB制限）
- ✅ ファイル形式自動判定: 正常動作

**テストコマンド**:
```bash
npm run test-file-parsers <ファイルパス>
```

### テスト観点

- ユニット: 各パーサー関数のテスト
- 検証方法: PDF、DOCX、XLSXのサンプルファイルでテキストが正しく抽出されることを確認




