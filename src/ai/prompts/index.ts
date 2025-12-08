/**
 * AIプロンプトテンプレート
 */
import type { MessageContext } from '../provider';
import type { TriageType } from '../../types/triage';

/**
 * トリアージプロンプトを構築
 */
export function buildTriagePrompt(context: MessageContext): string {
  const parts: string[] = [];

  parts.push('以下のメッセージを分析し、緊急度・重要度に基づいてType A/B/Cに分類してください。');
  parts.push('');
  parts.push('## 分類基準');
  parts.push('- **Type A**: 緊急・重要（即座の対応が必要）');
  parts.push('  - 例: 緊急の問い合わせ、重要な決定が必要、期限が迫っている');
  parts.push('- **Type B**: 通常（24時間以内の対応が望ましい）');
  parts.push('  - 例: 一般的な問い合わせ、情報提供、通常の業務連絡');
  parts.push('- **Type C**: 低優先度（後回し可能）');
  parts.push('  - 例: ニュースレター、マーケティングメール、通知のみ');
  parts.push('');

  if (context.subject) {
    parts.push(`## 件名`);
    parts.push(context.subject);
    parts.push('');
  }

  parts.push('## 本文');
  parts.push(context.body);
  parts.push('');

  if (context.threadHistory) {
    parts.push('## スレッド履歴');
    parts.push(context.threadHistory);
    parts.push('');
  }

  if (context.attachmentsText) {
    parts.push('## 添付ファイルの内容');
    parts.push(context.attachmentsText);
    parts.push('');
  }

  parts.push('## 出力形式');
  parts.push('以下のJSON形式で回答してください:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "type": "A" | "B" | "C",');
  parts.push('  "confidence": 0.0-1.0,');
  parts.push('  "reason": "分類理由の説明",');
  parts.push('  "priority_score": 0-100,');
  parts.push('  "details": {');
  parts.push('    "urgency": "high" | "medium" | "low",');
  parts.push('    "requires_response": true | false');
  parts.push('  }');
  parts.push('}');
  parts.push('```');

  return parts.join('\n');
}

/**
 * ドラフト生成プロンプトを構築
 */
export function buildDraftPrompt(
  context: MessageContext,
  triageType: TriageType,
  tone: 'formal' | 'casual' | 'brief' = 'formal'
): string {
  const parts: string[] = [];

  parts.push('以下のメッセージに対する返信ドラフトを作成してください。');
  parts.push('');

  // トーン設定
  const toneDescription = {
    formal: '丁寧でフォーマルな文体',
    casual: 'カジュアルで親しみやすい文体',
    brief: '簡潔で要点を押さえた文体'
  };

  parts.push(`## トーン: ${toneDescription[tone]}`);
  parts.push('');

  // トリアージタイプに応じた指示
  if (triageType === 'A') {
    parts.push('## 重要: 緊急メッセージへの返信');
    parts.push('- 迅速な対応を示す');
    parts.push('- 具体的な対応内容を明記');
    parts.push('- 必要に応じて次のステップを提示');
    parts.push('');
  } else if (triageType === 'B') {
    parts.push('## 通常メッセージへの返信');
    parts.push('- 適切な返信内容を提供');
    parts.push('- 必要に応じて追加情報を求める');
    parts.push('');
  } else {
    parts.push('## 低優先度メッセージへの返信');
    parts.push('- 簡潔に返信');
    parts.push('- 必要最小限の情報を提供');
    parts.push('');
  }

  if (context.subject) {
    parts.push(`## 件名`);
    parts.push(context.subject);
    parts.push('');
  }

  parts.push('## 本文');
  parts.push(context.body);
  parts.push('');

  if (context.threadHistory) {
    parts.push('## スレッド履歴（参考）');
    parts.push(context.threadHistory);
    parts.push('');
  }

  if (context.attachmentsText) {
    parts.push('## 添付ファイルの内容（参考）');
    parts.push(context.attachmentsText);
    parts.push('');
  }

  parts.push('## 返信ドラフト作成の指示');
  parts.push('1. メッセージの内容を理解し、適切な返信を作成してください');
  parts.push('2. 上記のトーンに従って文体を統一してください');
  parts.push('3. 必要に応じて質問や確認事項を含めてください');
  parts.push('4. 返信のみを出力してください（説明やコメントは不要）');

  return parts.join('\n');
}

/**
 * ADHD向けメッセージ柔軟化プロンプトを構築（LINEBOTがユーザーに語りかける形式）
 */
export function buildSoftenPrompt(
  context: MessageContext,
  senderName?: string,
  triageType?: 'A' | 'B' | 'C',
  draftReply?: string
): string {
  const parts: string[] = [];

  parts.push('あなたは、ADHDを持つユーザーをサポートする優しいLINEBOTです。');
  parts.push('以下のメッセージを**150文字以内**で優しく要約してください。');
  parts.push('');
  parts.push('## ルール');
  parts.push('1. 「○○さんから〜だよ」という形式で始める');
  parts.push('2. 責められていないことを伝える（例：困っているみたい、確認したいみたい）');
  parts.push('3. 次にやることを1つだけ提案する');
  parts.push('4. 親しみやすい口調（だよ、みたいだよ、しようか）');
  parts.push('');
  parts.push('## 例');
  parts.push('「○○さんから請求書の件だよ。怒ってるわけじゃなくて、届いてないから困ってるみたい。請求書送ってあげようか。」');
  parts.push('');
  parts.push('## ⚠️ 重要：150文字以内で簡潔に！');
  parts.push('');

  if (senderName) {
    parts.push(`送信者: ${senderName}`);
  }
  if (context.subject) {
    parts.push(`件名: ${context.subject}`);
  }
  parts.push(`本文: ${context.body.substring(0, 500)}`); // 本文は500文字まで
  parts.push('');

  if (triageType === 'A' && draftReply) {
    parts.push('※返信案あり→「返信文を考えたよ」と一言添える');
  }

  parts.push('');
  parts.push('150文字以内で出力してください。');

  return parts.join('\n');
}


