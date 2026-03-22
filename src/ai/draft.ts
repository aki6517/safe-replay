/**
 * AIドラフト生成サービス
 */
import type { TriageType } from '../types/triage';
import type { MessageContext } from './provider';
import { getOpenAIProvider } from './openai';

/**
 * 返信ドラフトを生成
 *
 * @param subject - 件名（オプション）
 * @param body - 本文
 * @param triageType - トリアージタイプ
 * @param context - スレッド履歴などのコンテキスト（オプション）
 * @param attachmentsText - 添付ファイルのテキスト抽出結果（オプション）
 * @param tone - トーン（formal/casual/brief）
 * @param userId - ユーザーID（利用量トラッキング用）
 * @returns 返信ドラフトテキスト
 */
export async function generateDraft(
  subject: string,
  body: string,
  triageType: TriageType,
  context?: string,
  attachmentsText?: string,
  tone: 'formal' | 'casual' | 'brief' = 'formal',
  userId?: string
): Promise<string> {
  try {
    const provider = getOpenAIProvider();
    if (userId) provider.setUserId(userId);

    const messageContext: MessageContext = {
      subject,
      body,
      threadHistory: context,
      attachmentsText
    };

    return await provider.generateDraft(messageContext, triageType, tone);
  } catch (error: any) {
    console.error('Draft generation error:', error);
    throw new Error(`Failed to generate draft: ${error.message}`);
  }
}




