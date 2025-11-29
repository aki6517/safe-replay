/**
 * DOCX解析モジュール
 */
import mammoth from 'mammoth';

/**
 * DOCXファイルからテキストを抽出
 * 
 * @param buffer - DOCXファイルのバッファ
 * @param maxSizeMB - 最大ファイルサイズ（MB、デフォルト: 10）
 * @returns 抽出されたテキスト
 */
export async function parseDOCX(
  buffer: Buffer,
  maxSizeMB: number = 10
): Promise<string> {
  // ファイルサイズチェック
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`DOCXファイルサイズが${maxSizeMB}MBを超えています: ${sizeMB.toFixed(2)}MB`);
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error: any) {
    throw new Error(`DOCX解析エラー: ${error.message}`);
  }
}

/**
 * DOCXファイルからHTML形式で抽出（書式情報を含む）
 * 
 * @param buffer - DOCXファイルのバッファ
 * @param maxSizeMB - 最大ファイルサイズ（MB、デフォルト: 10）
 * @returns 抽出されたHTMLテキスト
 */
export async function parseDOCXAsHTML(
  buffer: Buffer,
  maxSizeMB: number = 10
): Promise<string> {
  // ファイルサイズチェック
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`DOCXファイルサイズが${maxSizeMB}MBを超えています: ${sizeMB.toFixed(2)}MB`);
  }

  try {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value || '';
  } catch (error: any) {
    throw new Error(`DOCX HTML変換エラー: ${error.message}`);
  }
}


