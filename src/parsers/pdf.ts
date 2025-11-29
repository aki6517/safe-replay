/**
 * PDF解析モジュール
 */
import pdfParse from 'pdf-parse';

/**
 * PDFファイルからテキストを抽出
 * 
 * @param buffer - PDFファイルのバッファ
 * @param maxSizeMB - 最大ファイルサイズ（MB、デフォルト: 10）
 * @returns 抽出されたテキスト
 */
export async function parsePDF(
  buffer: Buffer,
  maxSizeMB: number = 10
): Promise<string> {
  // ファイルサイズチェック
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`PDFファイルサイズが${maxSizeMB}MBを超えています: ${sizeMB.toFixed(2)}MB`);
  }

  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error: any) {
    throw new Error(`PDF解析エラー: ${error.message}`);
  }
}

/**
 * PDFファイルのメタデータを取得
 * 
 * @param buffer - PDFファイルのバッファ
 * @returns メタデータ
 */
export async function getPDFMetadata(buffer: Buffer): Promise<{
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modDate?: Date;
  pages: number;
}> {
  try {
    const data = await pdfParse(buffer);
    return {
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      keywords: data.info?.Keywords,
      creator: data.info?.Creator,
      producer: data.info?.Producer,
      creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
      modDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
      pages: data.numpages || 0
    };
  } catch (error: any) {
    throw new Error(`PDFメタデータ取得エラー: ${error.message}`);
  }
}


