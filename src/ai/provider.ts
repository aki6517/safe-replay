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


