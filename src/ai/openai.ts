/**
 * OpenAI Provider実装
 */
import OpenAI from 'openai';
import type { AIProvider, MessageContext, AIProviderConfig } from './provider';
import type { TriageResult, TriageType } from '../types/triage';
import { buildTriagePrompt, buildDraftPrompt } from './prompts';

/**
 * OpenAI Providerクラス
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: Required<AIProviderConfig>;

  constructor(config: AIProviderConfig = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });

    // デフォルト設定
    // AI_PROVIDERまたはOPENAI_MODEL環境変数からモデル名を取得
    // AI_PROVIDERがモデル名として設定されている場合もサポート
    const modelFromEnv = process.env.OPENAI_MODEL || 
                        (process.env.AI_PROVIDER && process.env.AI_PROVIDER.startsWith('gpt-') ? process.env.AI_PROVIDER : null) ||
                        'gpt-4o-mini';
    
    this.config = {
      model: config.model || modelFromEnv,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2000,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000
    };
  }

  /**
   * メッセージをトリアージ（Type A/B/C分類）
   */
  async triage(context: MessageContext): Promise<TriageResult> {
    const prompt = buildTriagePrompt(context);

    try {
      const response = await this.callAPI(prompt, {
        temperature: 0.3, // トリアージは一貫性重視
        maxTokens: 500
      });

      return this.parseTriageResponse(response);
    } catch (error: any) {
      console.error('OpenAI triage error:', error);
      // エラー時はデフォルトでType Bを返す
      return {
        type: 'B',
        confidence: 0.0,
        reason: `Error: ${error.message}`,
        priority_score: 50
      };
    }
  }

  /**
   * 返信ドラフトを生成
   */
  async generateDraft(
    context: MessageContext,
    triageType: TriageType,
    tone: 'formal' | 'casual' | 'brief' = 'formal'
  ): Promise<string> {
    const prompt = buildDraftPrompt(context, triageType, tone);

    try {
      const response = await this.callAPI(prompt, {
        temperature: 0.7, // ドラフト生成は創造性重視
        maxTokens: this.config.maxTokens
      });

      return this.parseDraftResponse(response);
    } catch (error: any) {
      console.error('OpenAI draft generation error:', error);
      throw new Error(`Failed to generate draft: ${error.message}`);
    }
  }

  /**
   * OpenAI APIを呼び出し（リトライロジック付き）
   */
  private async callAPI(
    prompt: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    let lastError: Error | null = null;

    // gpt-5系モデルではmax_completion_tokensを使用
    const isGPT5Model = this.config.model.startsWith('gpt-5') || this.config.model.includes('gpt-5');
    const maxTokensParam = options.maxTokens ?? this.config.maxTokens;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const requestParams: any = {
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'あなたはメッセージ分析と返信作成の専門家です。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: options.temperature ?? this.config.temperature
        };

        // gpt-5系モデルではmax_completion_tokensを使用
        if (isGPT5Model) {
          requestParams.max_completion_tokens = maxTokensParam;
        } else {
          requestParams.max_tokens = maxTokensParam;
        }

        const response = await this.client.chat.completions.create(requestParams);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return content;
      } catch (error: any) {
        lastError = error;
        console.warn(`OpenAI API call failed (attempt ${attempt}/${this.config.retryAttempts}):`, error.message);

        // レート制限エラーの場合は待機
        if (error.status === 429 && attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * attempt; // 指数バックオフ
          await this.sleep(delay);
          continue;
        }

        // リトライ不可能なエラーの場合は即座にスロー
        if (error.status === 400 || error.status === 401 || error.status === 403) {
          throw error;
        }
      }
    }

    throw lastError || new Error('OpenAI API call failed after retries');
  }

  /**
   * トリアージレスポンスをパース
   */
  private parseTriageResponse(response: string): TriageResult {
    // JSON形式のレスポンスを期待
    try {
      // JSONブロックを抽出
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          type: parsed.type || 'B',
          confidence: parsed.confidence ?? 0.5,
          reason: parsed.reason || 'No reason provided',
          priority_score: parsed.priority_score ?? 50,
          details: parsed.details
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON response, using fallback:', error);
    }

    // フォールバック: テキストから推測
    const upperResponse = response.toUpperCase();
    if (upperResponse.includes('TYPE A') || upperResponse.includes('緊急') || upperResponse.includes('URGENT')) {
      return {
        type: 'A',
        confidence: 0.6,
        reason: 'Detected urgent keywords',
        priority_score: 90
      };
    }
    if (upperResponse.includes('TYPE C') || upperResponse.includes('低優先度') || upperResponse.includes('LOW')) {
      return {
        type: 'C',
        confidence: 0.6,
        reason: 'Detected low priority keywords',
        priority_score: 20
      };
    }

    // デフォルト: Type B
    return {
      type: 'B',
      confidence: 0.5,
      reason: 'Default classification',
      priority_score: 50
    };
  }

  /**
   * ドラフトレスポンスをパース
   */
  private parseDraftResponse(response: string): string {
    // マークダウンのコードブロックを除去
    const cleaned = response.replace(/```[\s\S]*?```/g, '').trim();
    return cleaned || response;
  }

  /**
   * スリープ（リトライ用）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * デフォルトのOpenAI Providerインスタンスを取得
 */
let defaultProvider: OpenAIProvider | null = null;

export function getOpenAIProvider(config?: AIProviderConfig): OpenAIProvider {
  if (!defaultProvider) {
    defaultProvider = new OpenAIProvider(config);
  }
  return defaultProvider;
}

