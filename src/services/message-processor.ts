/**
 * メッセージ処理サービス
 */
// TODO: 実装時に必要なインポートを追加
// import { getSupabase, isSupabaseAvailable } from '../db/client';
// import { triageMessage } from '../ai/triage';
// import { generateDraft } from '../ai/draft';
// import { sendLineNotification } from './notifier';

export async function processForwardedMessage(
  userId: string,
  text: string
): Promise<void> {
  // 転送メッセージを処理
  // TODO: 実装
  console.log('Processing forwarded message:', { userId, text });
}

