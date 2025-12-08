/**
 * AI Provider Interface（Model Agnostic設計）
 * 
 * 複数のAIプロバイダー（OpenAI、Anthropic、Gemini等）に対応するための抽象インターフェース
 */
import type { TriageResult, TriageType } from '../types/triage';

/**
 * メッセージコンテキスト
 */
export interface MessageContext {
  subject?: string;
  body: string;
  threadHistory?: string; // スレッド履歴（テキスト形式）
  attachmentsText?: string; // 添付ファイルのテキスト抽出結果
  senderName?: string;
  sourceType?: 'gmail' | 'chatwork' | 'line_forward';
}

/**
 * AI Providerインターフェース
 */
export interface AIProvider {
  /**
   * メッセージをトリアージ（Type A/B/C分類）
   * 
   * @param context - メッセージコンテキスト
   * @returns トリアージ結果
   */
  triage(context: MessageContext): Promise<TriageResult>;

  /**
   * 返信ドラフトを生成
   * 
   * @param context - メッセージコンテキスト
   * @param triageType - トリアージタイプ
   * @param tone - トーン（formal/casual/brief）
   * @returns 返信ドラフトテキスト
   */
  generateDraft(
    context: MessageContext,
    triageType: TriageType,
    tone?: 'formal' | 'casual' | 'brief'
  ): Promise<string>;

  /**
   * メッセージをADHD向けに柔らかく変換・要約（LINEBOTがユーザーに語りかける形式）
   * 
   * @param context - メッセージコンテキスト
   * @param senderName - 送信者名（オプション）
   * @param triageType - トリアージタイプ（オプション）
   * @param draftReply - 返信案（オプション、Type Aの場合）
   * @returns 変換されたメッセージテキスト
   */
  softenMessage(
    context: MessageContext,
    senderName?: string,
    triageType?: 'A' | 'B' | 'C',
    draftReply?: string
  ): Promise<string>;
}

/**
 * AI Providerの設定
 */
export interface AIProviderConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}


