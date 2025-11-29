/**
 * ファイル解析統合インターフェース
 */
import { parsePDF, getPDFMetadata } from './pdf';
import { parseDOCX, parseDOCXAsHTML } from './docx';
import { parseXLSX, getXLSXSheetNames } from './xlsx';

/**
 * サポートされているファイル形式
 */
export type SupportedFileType = 'pdf' | 'docx' | 'xlsx';

/**
 * ファイル解析結果
 */
export interface ParseResult {
  text: string;
  html?: string; // DOCXの場合のみ
  metadata?: Record<string, any>;
  pages?: number; // PDFの場合のみ
  sheets?: string[]; // XLSXの場合のみ
}

/**
 * ファイル形式を判定
 * 
 * @param filename - ファイル名
 * @param mimeType - MIMEタイプ（オプション）
 * @returns ファイル形式、またはnull（未対応）
 */
export function detectFileType(
  filename: string,
  mimeType?: string
): SupportedFileType | null {
  const ext = filename.toLowerCase().split('.').pop();

  // 拡張子から判定
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx') return 'xlsx';

  // MIMEタイプから判定（拡張子が不明な場合）
  if (mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  }

  return null;
}

/**
 * ファイルを解析
 * 
 * @param buffer - ファイルのバッファ
 * @param filename - ファイル名
 * @param mimeType - MIMEタイプ（オプション）
 * @param maxSizeMB - 最大ファイルサイズ（MB、デフォルト: 10）
 * @returns 解析結果
 */
export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
  maxSizeMB: number = 10
): Promise<ParseResult> {
  const fileType = detectFileType(filename, mimeType);

  if (!fileType) {
    throw new Error(`未対応のファイル形式です: ${filename}`);
  }

  // ファイルサイズチェック（共通）
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`ファイルサイズが${maxSizeMB}MBを超えています: ${sizeMB.toFixed(2)}MB`);
  }

  switch (fileType) {
    case 'pdf': {
      const text = await parsePDF(buffer, maxSizeMB);
      const metadata = await getPDFMetadata(buffer);
      return {
        text,
        metadata: {
          title: metadata.title,
          author: metadata.author,
          pages: metadata.pages
        },
        pages: metadata.pages
      };
    }

    case 'docx': {
      const text = await parseDOCX(buffer, maxSizeMB);
      const html = await parseDOCXAsHTML(buffer, maxSizeMB);
      return {
        text,
        html
      };
    }

    case 'xlsx': {
      const text = await parseXLSX(buffer, maxSizeMB);
      const sheets = await getXLSXSheetNames(buffer);
      return {
        text,
        sheets
      };
    }

    default:
      throw new Error(`未対応のファイル形式です: ${fileType}`);
  }
}

/**
 * ファイルがサポートされているかチェック
 * 
 * @param filename - ファイル名
 * @param mimeType - MIMEタイプ（オプション）
 * @returns サポートされている場合true
 */
export function isFileSupported(
  filename: string,
  mimeType?: string
): boolean {
  return detectFileType(filename, mimeType) !== null;
}

// 個別のパーサー関数もエクスポート
export { parsePDF, getPDFMetadata } from './pdf';
export { parseDOCX, parseDOCXAsHTML } from './docx';
export { parseXLSX, getXLSXSheetNames } from './xlsx';

