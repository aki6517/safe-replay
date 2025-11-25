/**
 * LINE通知サービス
 */
// TODO: 実装時にインポートを有効化
// import { getLineClient, isLineClientAvailable } from './line';
import type { TriageType } from '../types/triage';

export async function sendLineNotification(
  userId: string,
  triageType: TriageType,
  message: {
    subject?: string;
    body: string;
    sender: string;
    source: string;
  },
  draft?: string
): Promise<void> {
  // TODO: Flex Message実装
  console.log('Sending notification:', { userId, triageType, message, draft });
}

