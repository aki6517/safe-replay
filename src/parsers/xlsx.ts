/**
 * XLSX解析モジュール
 */
import * as XLSX from 'xlsx';

/**
 * XLSXファイルからテキストを抽出
 * 
 * @param buffer - XLSXファイルのバッファ
 * @param maxSizeMB - 最大ファイルサイズ（MB、デフォルト: 10）
 * @returns 抽出されたテキスト
 */
export async function parseXLSX(
  buffer: Buffer,
  maxSizeMB: number = 10
): Promise<string> {
  // ファイルサイズチェック
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`XLSXファイルサイズが${maxSizeMB}MBを超えています: ${sizeMB.toFixed(2)}MB`);
  }

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];

    // 各シートを処理
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      // シート名を追加
      sheets.push(`=== シート: ${sheetName} ===`);
      
      // 各行をテキストに変換
      for (const row of sheetData) {
        if (Array.isArray(row)) {
          const rowText = row
            .map((cell: any) => String(cell || ''))
            .filter((cell: string) => cell.trim().length > 0)
            .join(' | ');
          if (rowText.trim().length > 0) {
            sheets.push(rowText);
          }
        }
      }
      
      sheets.push(''); // シート間の区切り
    }

    return sheets.join('\n').trim();
  } catch (error: any) {
    throw new Error(`XLSX解析エラー: ${error.message}`);
  }
}

/**
 * XLSXファイルのシート一覧を取得
 * 
 * @param buffer - XLSXファイルのバッファ
 * @returns シート名のリスト
 */
export async function getXLSXSheetNames(buffer: Buffer): Promise<string[]> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames || [];
  } catch (error: any) {
    throw new Error(`XLSXシート一覧取得エラー: ${error.message}`);
  }
}


