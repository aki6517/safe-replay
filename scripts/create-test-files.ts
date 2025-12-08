/**
 * テスト用ファイル作成スクリプト
 * 
 * 使用方法:
 * npm run create-test-files
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PptxGenJS from 'pptxgenjs';

const testFilesDir = path.join(__dirname, '..', 'test-files');

// ディレクトリを作成
if (!fs.existsSync(testFilesDir)) {
  fs.mkdirSync(testFilesDir, { recursive: true });
}

/**
 * PDFファイルを作成（最小限の有効なPDF）
 */
function createPDF(): Buffer {
  // 最小限の有効なPDF構造
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(テスト用PDFファイル) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000306 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
400
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * DOCXファイルを作成
 */
async function createDOCX(): Promise<Buffer> {
  // docxライブラリを使用してDOCXファイルを作成
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'テスト用DOCXファイル',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'これはテスト用のDOCXファイルです。',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '複数の段落を含むサンプル文書です。',
              }),
            ],
          }),
        ],
      },
    ],
  });

  // バッファに変換
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * XLSXファイルを作成
 */
function createXLSX(): Buffer {
  // xlsxライブラリを使用してXLSXファイルを作成
  const workbook = XLSX.utils.book_new();
  
  // シート1: テストデータ
  const sheet1Data = [
    ['名前', '年齢', '部署'],
    ['山田太郎', 30, '営業部'],
    ['佐藤花子', 25, '開発部'],
    ['鈴木一郎', 35, 'マーケティング部']
  ];
  const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(workbook, sheet1, 'テストシート1');
  
  // シート2: 数値データ
  const sheet2Data = [
    ['項目', '値'],
    ['売上', 1000000],
    ['経費', 500000],
    ['利益', 500000]
  ];
  const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  XLSX.utils.book_append_sheet(workbook, sheet2, 'テストシート2');
  
  // バッファに書き込み
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * PPTXファイルを作成
 */
async function createPPTX(): Promise<Buffer> {
  // pptxgenjsライブラリを使用してPPTXファイルを作成
  const pptx = new PptxGenJS();
  
  // スライド1を追加
  const slide1 = pptx.addSlide();
  slide1.addText('テスト用PPTXファイル', {
    x: 1,
    y: 1,
    w: 8,
    h: 1,
    fontSize: 32,
    bold: true,
  });
  slide1.addText('これはテスト用のPPTXファイルです。', {
    x: 1,
    y: 2.5,
    w: 8,
    h: 1,
    fontSize: 18,
  });
  
  // スライド1の発表者ノートを追加
  slide1.addNotes('これはスライド1の発表者ノートです。テスト用の内容です。');
  
  // スライド2を追加
  const slide2 = pptx.addSlide();
  slide2.addText('スライド2', {
    x: 1,
    y: 1,
    w: 8,
    h: 1,
    fontSize: 32,
    bold: true,
  });
  slide2.addText('2枚目のスライドです。', {
    x: 1,
    y: 2.5,
    w: 8,
    h: 1,
    fontSize: 18,
  });
  
  // スライド2の発表者ノートを追加
  slide2.addNotes('これはスライド2の発表者ノートです。');
  
  // バッファに変換
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}

/**
 * メイン処理
 */
async function main() {
  console.log('📁 テストファイルを作成します...\n');

  try {
    // PDFファイルを作成
    const pdfBuffer = createPDF();
    const pdfPath = path.join(testFilesDir, 'sample.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`✅ PDFファイルを作成: ${pdfPath} (${pdfBuffer.length} bytes)`);

    // DOCXファイルを作成
    const docxBuffer = await createDOCX();
    const docxPath = path.join(testFilesDir, 'sample.docx');
    fs.writeFileSync(docxPath, docxBuffer);
    console.log(`✅ DOCXファイルを作成: ${docxPath} (${docxBuffer.length} bytes)`);

    // XLSXファイルを作成
    const xlsxBuffer = createXLSX();
    const xlsxPath = path.join(testFilesDir, 'sample.xlsx');
    fs.writeFileSync(xlsxPath, xlsxBuffer);
    console.log(`✅ XLSXファイルを作成: ${xlsxPath} (${xlsxBuffer.length} bytes)`);

    // PPTXファイルを作成
    const pptxBuffer = await createPPTX();
    const pptxPath = path.join(testFilesDir, 'sample.pptx');
    fs.writeFileSync(pptxPath, pptxBuffer);
    console.log(`✅ PPTXファイルを作成: ${pptxPath} (${pptxBuffer.length} bytes)`);

    console.log('\n✅ すべてのテストファイルを作成しました！');
    console.log('\n使用方法:');
    console.log('  npm run test-file-parsers ./test-files/sample.pdf');
    console.log('  npm run test-file-parsers ./test-files/sample.docx');
    console.log('  npm run test-file-parsers ./test-files/sample.xlsx');
    console.log('  npm run test-file-parsers ./test-files/sample.pptx');
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

main();

