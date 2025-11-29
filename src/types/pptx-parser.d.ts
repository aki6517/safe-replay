/**
 * pptx-parser型定義
 */
declare module 'pptx-parser' {
  export interface PPTXShape {
    text?: string;
    type?: string;
    [key: string]: any;
  }

  export interface PPTXSlide {
    text?: string;
    shapes?: PPTXShape[];
    notes?: string;
    notesSlide?: {
      text?: string;
      shapes?: PPTXShape[];
      [key: string]: any;
    };
    [key: string]: any;
  }

  export interface PPTXPresentation {
    slides?: PPTXSlide[];
    [key: string]: any;
  }

  export function parse(buffer: Buffer): Promise<PPTXPresentation>;
}


