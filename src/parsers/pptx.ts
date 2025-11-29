/**
 * PPTX解析モジュール
 */
import { parse } from 'pptx-parser';

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
    // pptx-parserでパース
    const presentation = await parse(buffer);

    const slides: Array<{
      slideNumber: number;
      text: string;
      notes: string;
    }> = [];
    const allTexts: string[] = [];
    const allNotes: string[] = [];

    // 各スライドを処理
    if (presentation.slides && Array.isArray(presentation.slides)) {
      for (let i = 0; i < presentation.slides.length; i++) {
        const slide = presentation.slides[i];
        const slideNumber = i + 1;

        // スライドテキストを抽出
        let slideText = '';
        if (slide.text) {
          slideText = slide.text;
        } else if (slide.shapes) {
          // shapesからテキストを抽出
          const shapeTexts: string[] = [];
          for (const shape of slide.shapes) {
            if (shape.text) {
              shapeTexts.push(shape.text);
            }
          }
          slideText = shapeTexts.join('\n');
        }

        // 発表者ノートを抽出
        let notesText = '';
        if (slide.notes) {
          notesText = slide.notes;
        } else if (slide.notesSlide) {
          // notesSlideからテキストを抽出
          if (slide.notesSlide.text) {
            notesText = slide.notesSlide.text;
          } else if (slide.notesSlide.shapes) {
            const noteTexts: string[] = [];
            for (const shape of slide.notesSlide.shapes) {
              if (shape.text) {
                noteTexts.push(shape.text);
              }
            }
            notesText = noteTexts.join('\n');
          }
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
    const presentation = await parse(buffer);
    if (presentation.slides && Array.isArray(presentation.slides)) {
      return presentation.slides.length;
    }
    return 0;
  } catch (error: any) {
    throw new Error(`PPTXスライド数取得エラー: ${error.message}`);
  }
}

