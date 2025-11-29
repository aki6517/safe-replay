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

- [ ] `src/parsers/pdf.ts`でPDF解析を実装（pdf-parse使用）
- [ ] `src/parsers/docx.ts`でDOCX解析を実装（mammoth使用）
- [ ] `src/parsers/xlsx.ts`でXLSX解析を実装（xlsx使用）
- [ ] `src/parsers/index.ts`で統合インターフェースを実装
- [ ] ファイルサイズ10MB制限を実装
- [ ] エラーハンドリングを実装
- [ ] 各形式のサンプルファイルで動作確認

### テスト観点

- ユニット: 各パーサー関数のテスト
- 検証方法: PDF、DOCX、XLSXのサンプルファイルでテキストが正しく抽出されることを確認




