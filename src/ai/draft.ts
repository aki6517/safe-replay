/**
 * AIドラフト生成サービス
 */
export async function generateDraft(
  subject: string,
  body: string,
  triageType: 'A' | 'B' | 'C',
  context?: string,
  attachmentsText?: string,
  tone: 'formal' | 'casual' | 'brief' = 'formal'
): Promise<string> {
  // TODO: AI実装
  console.log('Generate draft:', {
    subject,
    body,
    triageType,
    context,
    attachmentsText,
    tone
  });

  // 仮実装
  return '返信ドラフト（未実装）';
}

