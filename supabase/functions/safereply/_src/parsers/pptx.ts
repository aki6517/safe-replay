/**
 * PPTX解析モジュール
 * PPTXファイルはZIP形式なので、ZIPを解凍してXMLを解析する
 */
import JSZip from 'jszip';
import { parseString } from 'xml2js';

/**
 * XMLからテキストを抽出（再帰的）
 */
function extractTextFromXml(obj: any): string {
  if (typeof obj === 'string') {
    return obj.trim();
  }
  if (Array.isArray(obj)) {
    return obj.map(item => extractTextFromXml(item)).filter(t => t).join(' ');
  }
  if (obj && typeof obj === 'object') {
    // PowerPointのXMLでは、テキストは通常 'a:t' または 't' 要素に含まれる
    if (obj['a:t']) {
      return extractTextFromXml(obj['a:t']);
    }
    if (obj['t']) {
      return extractTextFromXml(obj['t']);
    }
    // オブジェクトのすべてのプロパティを再帰的に処理
    const texts: string[] = [];
    for (const key in obj) {
      if (key !== '_' && key !== '$') {
        const text = extractTextFromXml(obj[key]);
        if (text) {
          texts.push(text);
        }
      }
    }
    return texts.join(' ');
  }
  return '';
}

/**
 * XMLをパースしてテキストを抽出
 */
async function parseXmlToText(xmlContent: string): Promise<string> {
  return new Promise((resolve, reject) => {
    parseString(xmlContent, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      const text = extractTextFromXml(result);
      resolve(text);
    });
  });
}

/**
 * PPTXファイルからテキストと発表者ノートを抽出
 * 
 * @param buffer - PPTXファイルのバッファ
 * @param maxSizeMB - 最大ファイルサイズ（MB、デフォルト: 10）
 * @returns 抽出されたテキストとノート
 */
export async function parsePPTX(
  buffer: Buffer,
  maxSizeMB: number = 10
): Promise<{
  text: string;
  notes: string;
  slides: Array<{
    slideNumber: number;
    text: string;
    notes: string;
  }>;
}> {
  // ファイルサイズチェック
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`PPTXファイルサイズが${maxSizeMB}MBを超えています: ${sizeMB.toFixed(2)}MB`);
  }

  try {
    // ZIPとして解凍
    const zip = await JSZip.loadAsync(buffer);
    const slides: Array<{
      slideNumber: number;
      text: string;
      notes: string;
    }> = [];
    const allTexts: string[] = [];
    const allNotes: string[] = [];

    // スライドファイルを取得（ppt/slides/slide*.xml）
    const slideFiles: Array<{ name: string; index: number }> = [];
    zip.forEach((relativePath) => {
      const match = relativePath.match(/ppt\/slides\/slide(\d+)\.xml/);
      if (match) {
        slideFiles.push({
          name: relativePath,
          index: parseInt(match[1], 10)
        });
      }
    });

    // スライドをインデックス順にソート
    slideFiles.sort((a, b) => a.index - b.index);

    // 各スライドを処理
    for (const slideFile of slideFiles) {
      const slideNumber = slideFile.index;
      let slideText = '';
      let notesText = '';

      try {
        // スライドXMLを取得
        const slideXml = await zip.file(slideFile.name)?.async('string');
        if (slideXml) {
          slideText = await parseXmlToText(slideXml);
        }
      } catch (error: any) {
        console.warn(`スライド ${slideNumber} のテキスト抽出に失敗: ${error.message}`);
      }

      try {
        // 発表者ノートXMLを取得（ppt/notesSlides/notesSlide*.xml）
        const notesSlidePath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
        const notesSlideXml = await zip.file(notesSlidePath)?.async('string');
        if (notesSlideXml) {
          notesText = await parseXmlToText(notesSlideXml);
        }
      } catch (error: any) {
        // ノートがない場合は空文字列のまま
        // console.warn(`スライド ${slideNumber} のノート抽出に失敗: ${error.message}`);
      }

      slides.push({
        slideNumber,
        text: slideText,
        notes: notesText
      });

      if (slideText.trim()) {
        allTexts.push(`=== スライド ${slideNumber} ===\n${slideText}`);
      }
      if (notesText.trim()) {
        allNotes.push(`=== スライド ${slideNumber} 発表者ノート ===\n${notesText}`);
      }
    }

    // 全体のテキストを結合
    const combinedText = allTexts.join('\n\n');
    const combinedNotes = allNotes.join('\n\n');

    return {
      text: combinedText,
      notes: combinedNotes,
      slides
    };
  } catch (error: any) {
    throw new Error(`PPTX解析エラー: ${error.message}`);
  }
}

/**
 * PPTXファイルのスライド数を取得
 * 
 * @param buffer - PPTXファイルのバッファ
 * @returns スライド数
 */
export async function getPPTXSlideCount(buffer: Buffer): Promise<number> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    let slideCount = 0;
    
    zip.forEach((relativePath) => {
      if (/ppt\/slides\/slide\d+\.xml/.test(relativePath)) {
        slideCount++;
      }
    });
    
    return slideCount;
  } catch (error: any) {
    throw new Error(`PPTXスライド数取得エラー: ${error.message}`);
  }
}
