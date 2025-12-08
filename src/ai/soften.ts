/**
 * AIメッセージ柔軟化サービス（ADHD向け・LINEBOTがユーザーに語りかける形式）
 */
import type { MessageContext } from './provider';
import type { TriageType } from '../types/triage';
import { getOpenAIProvider } from './openai';

/**
 * メッセージをADHD向けに柔らかく変換・要約（LINEBOTがユーザーに語りかける形式）
 * 
 * @param subject - 件名（オプション）
 * @param body - 本文
 * @param senderName - 送信者名（オプション）
 * @param triageType - トリアージタイプ（オプション）
 * @param draftReply - 返信案（オプション、Type Aの場合）
 * @param context - スレッド履歴などのコンテキスト（オプション）
 * @param attachmentsText - 添付ファイルのテキスト抽出結果（オプション）
 * @returns 変換されたメッセージテキスト
 */
export async function softenMessage(
  subject: string,
  body: string,
  senderName?: string,
  triageType?: TriageType,
  draftReply?: string,
  context?: string,
  attachmentsText?: string
): Promise<string> {
  try {
    const provider = getOpenAIProvider();
    const messageContext: MessageContext = {
      subject,
      body,
      threadHistory: context,
      attachmentsText
    };

    return await provider.softenMessage(messageContext, senderName, triageType, draftReply);
  } catch (error: any) {
    console.error('Soften message error:', error);
    // エラー時は元のメッセージを返す（フォールバック）
    return body;
  }
}

