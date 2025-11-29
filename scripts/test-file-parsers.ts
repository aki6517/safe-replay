/**
 * ファイル解析モジュールの動作確認スクリプト
 * 
 * 使用方法:
 * npm run test-file-parsers <ファイルパス>
 * 
 * 例:
 * npm run test-file-parsers ./test-files/sample.pdf
 * npm run test-file-parsers ./test-files/sample.docx
 * npm run test-file-parsers ./test-files/sample.xlsx
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseFile, isFileSupported, detectFileType } from '../src/parsers';

async function testFileParser(filePath: string) {
  console.log('🧪 ファイル解析動作確認テスト\n');

  // 1. ファイルの存在確認
  if (!fs.existsSync(filePath)) {
    console.error(`❌ エラー: ファイルが見つかりません: ${filePath}`);
    console.error('\n使用方法:');
    console.error('  npm run test-file-parsers <ファイルパス>');
    console.error('\n例:');
    console.error('  npm run test-file-parsers ./test-files/sample.pdf');
    process.exit(1);
  }

  const filename = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  console.log(`📁 ファイル情報:`);
  console.log(`   パス: ${filePath}`);
  console.log(`   ファイル名: ${filename}`);
  console.log(`   サイズ: ${fileSizeMB.toFixed(2)}MB`);
  console.log('');

  // 2. ファイル形式の判定
  console.log('1️⃣ ファイル形式の判定...');
  const fileType = detectFileType(filename);
  const supported = isFileSupported(filename);

  if (!supported || !fileType) {
    console.error(`❌ エラー: 未対応のファイル形式です: ${filename}`);
    console.error('   サポートされている形式: PDF (.pdf), DOCX (.docx), XLSX (.xlsx), PPTX (.pptx)');
    process.exit(1);
  }

  console.log(`   ✅ ファイル形式: ${fileType.toUpperCase()}`);
  console.log(`   ✅ サポートされています`);
  console.log('');

  // 3. ファイルサイズチェック
  console.log('2️⃣ ファイルサイズチェック...');
  const maxSizeMB = 10;
  if (fileSizeMB > maxSizeMB) {
    console.error(`❌ エラー: ファイルサイズが${maxSizeMB}MBを超えています: ${fileSizeMB.toFixed(2)}MB`);
    process.exit(1);
  }
  console.log(`   ✅ ファイルサイズ: ${fileSizeMB.toFixed(2)}MB (制限: ${maxSizeMB}MB)`);
  console.log('');

  // 4. ファイルの読み込み
  console.log('3️⃣ ファイルの読み込み...');
  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(filePath);
    console.log(`   ✅ ファイルを読み込みました (${buffer.length} bytes)`);
    console.log('');
  } catch (error: any) {
    console.error(`❌ エラー: ファイルの読み込みに失敗しました: ${error.message}`);
    process.exit(1);
  }

  // 5. ファイル解析
  console.log('4️⃣ ファイル解析...');
  try {
    const result = await parseFile(buffer, filename, undefined, maxSizeMB);

    console.log(`   ✅ 解析が完了しました`);
    console.log('');

    // 6. 解析結果の表示
    console.log('5️⃣ 解析結果:');
    console.log('');

    // テキスト抽出結果
    const textLength = result.text.length;
    const textPreview = result.text.substring(0, 500);
    console.log(`📄 抽出されたテキスト (${textLength}文字):`);
    console.log('─'.repeat(60));
    console.log(textPreview);
    if (textLength > 500) {
      console.log(`... (残り ${textLength - 500}文字)`);
    }
    console.log('─'.repeat(60));
    console.log('');

    // PDFの場合: メタデータとページ数
    if (result.metadata) {
      console.log('📋 メタデータ:');
      Object.entries(result.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          console.log(`   ${key}: ${value}`);
        }
      });
      console.log('');
    }

    if (result.pages) {
      console.log(`📑 ページ数: ${result.pages}`);
      console.log('');
    }

    // DOCXの場合: HTML形式
    if (result.html) {
      const htmlLength = result.html.length;
      const htmlPreview = result.html.substring(0, 500);
      console.log(`🌐 HTML形式 (${htmlLength}文字):`);
      console.log('─'.repeat(60));
      console.log(htmlPreview);
      if (htmlLength > 500) {
        console.log(`... (残り ${htmlLength - 500}文字)`);
      }
      console.log('─'.repeat(60));
      console.log('');
    }

    // XLSXの場合: シート一覧
    if (result.sheets) {
      console.log(`📊 シート一覧 (${result.sheets.length}シート):`);
      result.sheets.forEach((sheet, index) => {
        console.log(`   ${index + 1}. ${sheet}`);
      });
      console.log('');
    }

    // PPTXの場合: 発表者ノートとスライド情報
    if (result.notes) {
      const notesLength = result.notes.length;
      const notesPreview = result.notes.substring(0, 500);
      console.log(`📝 発表者ノート (${notesLength}文字):`);
      console.log('─'.repeat(60));
      console.log(notesPreview);
      if (notesLength > 500) {
        console.log(`... (残り ${notesLength - 500}文字)`);
      }
      console.log('─'.repeat(60));
      console.log('');
    }

    if (result.slides) {
      console.log(`📑 スライド数: ${result.slides.length}`);
      if (result.slides.length > 0) {
        console.log(`   スライド情報（最初の3スライド）:`);
        for (let i = 0; i < Math.min(result.slides.length, 3); i++) {
          const slide = result.slides[i];
          console.log(`   ${slide.slideNumber}: テキスト ${slide.text.length}文字, ノート ${slide.notes.length}文字`);
        }
      }
      console.log('');
    }

    console.log('✅ すべてのテストが成功しました！\n');
  } catch (error: any) {
    console.error(`❌ エラー: ファイル解析に失敗しました: ${error.message}`);
    console.error('\nトラブルシューティング:');
    console.error('1. ファイルが破損していないか確認してください');
    console.error('2. ファイル形式が正しいか確認してください');
    console.error('3. ファイルサイズが10MB以下か確認してください');
    process.exit(1);
  }
}

// コマンドライン引数の取得
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ エラー: ファイルパスが指定されていません');
    console.error('\n使用方法:');
    console.error('  npm run test-file-parsers <ファイルパス>');
    console.error('\n例:');
    console.error('  npm run test-file-parsers ./test-files/sample.pdf');
    console.error('  npm run test-file-parsers ./test-files/sample.docx');
    console.error('  npm run test-file-parsers ./test-files/sample.xlsx');
    console.error('  npm run test-file-parsers ./test-files/sample.pptx');
  process.exit(1);
}

testFileParser(filePath).catch((error) => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});

