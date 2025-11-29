/**
 * AIトリアージサービス
 */
import type { TriageResult } from '../types/triage';

export async function triageMessage(
  subject: string,
  body: string,
  context?: string,
  attachmentsText?: string
): Promise<TriageResult> {
  // TODO: AI実装
  console.log('Triage message:', { subject, body, context, attachmentsText });

  // 仮実装
  return {
    type: 'B',
    confidence: 0.5,
    reason: 'Not implemented yet'
  };
}




