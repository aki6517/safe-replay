/**
 * AIトリアージサービス
 */
import type { TriageResult } from '../types/triage';
import type { MessageContext } from './provider';
import { getOpenAIProvider } from './openai';

/**
 * メッセージをトリアージ（Type A/B/C分類）
 * 
 * @param subject - 件名（オプション）
 * @param body - 本文
 * @param context - スレッド履歴などのコンテキスト（オプション）
 * @param attachmentsText - 添付ファイルのテキスト抽出結果（オプション）
 * @returns トリアージ結果
 */
export async function triageMessage(
  subject: string,
  body: string,
  context?: string,
  attachmentsText?: string
): Promise<TriageResult> {
  try {
    const provider = getOpenAIProvider();
    const messageContext: MessageContext = {
      subject,
      body,
      threadHistory: context,
      attachmentsText
    };

    return await provider.triage(messageContext);
  } catch (error: any) {
    console.error('Triage error:', error);
    // エラー時はデフォルトでType Bを返す
    return {
      type: 'B',
      confidence: 0.0,
      reason: `Error: ${error.message}`,
      priority_score: 50
    };
  }
}




