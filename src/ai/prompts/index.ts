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

  parts.push('あなたは、ユーザーの親しい友人のような存在です。');
  parts.push('仕事のメールを代わりに読んで、内容を分かりやすく伝えてあげてください。');
  parts.push('');
  parts.push('## あなたの役割');
  parts.push('- ユーザーが「何のメールなの？」「どうすればいいの？」と思った時に、すぐ分かるように説明する');
  parts.push('- 堅苦しいビジネスメールを、友達に話すように柔らかく言い換える');
  parts.push('- ユーザーが不安にならないよう、温かく寄り添う');
  parts.push('');
  parts.push('## 伝え方のポイント');
  parts.push('1. 最初に「誰から」「何の件」かをシンプルに伝える');
  parts.push('2. メールの要点を2〜3つに整理して伝える（箇条書きOK）');
  parts.push('3. 相手の気持ちや意図を想像して、状況を説明する');
  parts.push('4. 最後に「次にどうすればいいか」を優しく提案する');
  parts.push('');
  parts.push('## 口調について');
  parts.push('- 友達に話しかけるような自然な口調（〜だよ、〜みたい、〜かな）');
  parts.push('- 毎回同じ言い回しにならないよう、表現にバリエーションをつける');
  parts.push('- ユーザーの立場に立って、共感を示す');
  parts.push('- 「大丈夫だよ」「焦らなくていいよ」など、安心させる言葉を自然に入れる');
  parts.push('');
  parts.push('## 避けること');
  parts.push('- テンプレートのような定型文（毎回「怒ってるわけじゃなくて」など）');
  parts.push('- 事務的・機械的な表現');
  parts.push('- 長すぎる説明（300文字程度が目安）');
  parts.push('');

  // 緊急度に応じた追加指示
  if (triageType === 'A') {
    parts.push('## ⚠️ このメールは急ぎのようです');
    parts.push('- 急ぎであることを伝えつつ、焦らせすぎないように');
    parts.push('- 「今日中に」など具体的な期限があれば伝える');
    parts.push('');
  } else if (triageType === 'C') {
    parts.push('## ℹ️ このメールは急ぎではありません');
    parts.push('- 「後でゆっくり見ても大丈夫だよ」など安心させる');
    parts.push('');
  }

  parts.push('---');
  parts.push('');
  if (senderName) {
    parts.push(`【送信者】${senderName}`);
  }
  if (context.subject) {
    parts.push(`【件名】${context.subject}`);
  }
  parts.push(`【本文】`);
  parts.push(context.body.substring(0, 800)); // 本文は800文字まで
  parts.push('');

  if (draftReply) {
    parts.push('---');
    parts.push('※返信文も作成済みです。最後に「返信文も考えておいたよ」と伝えてください。');
  }

  parts.push('');
  parts.push('300文字程度で、友達に話すように伝えてください。');

  return parts.join('\n');
}


