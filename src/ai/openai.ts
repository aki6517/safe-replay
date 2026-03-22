/**
 * OpenAI Provider実装
 */
import OpenAI from 'openai';
import type { AIProvider, MessageContext, AIProviderConfig } from './provider';
import type { TriageResult, TriageType } from '../types/triage';
import { buildTriagePrompt, buildDraftPrompt, buildSoftenPrompt } from './prompts';
import { getSupabase, isSupabaseAvailable } from '../db/client';

/**
 * usage_logsテーブルに利用量を記録
 */
async function logUsage(
  userId: string | undefined,
  operation: string,
  tokensUsed: number
): Promise<void> {
  if (!userId || !isSupabaseAvailable()) return;
  try {
    const supabase = getSupabase();
    await (supabase.from('usage_logs') as any).insert({
      user_id: userId,
      service: 'openai',
      operation,
      tokens_used: tokensUsed
    });
  } catch (error) {
    console.warn('[logUsage] Failed to log usage:', error);
  }
}

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

  /** 利用量ログ用のユーザーID（ポーリング時にセットされる） */
  private _currentUserId?: string;

  /** ユーザーIDをセット（利用量ログ用） */
  setUserId(userId: string | undefined): void {
    this._currentUserId = userId;
  }

  /**
   * メッセージをトリアージ（Type A/B/C分類）
   */
  async triage(context: MessageContext): Promise<TriageResult> {
    const prompt = buildTriagePrompt(context);

    try {
      const { content, totalTokens } = await this.callAPIWithUsage(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });

      // 利用量ログ
      logUsage(this._currentUserId, 'triage', totalTokens);

      return this.parseTriageResponse(content);
    } catch (error: any) {
      console.error('OpenAI triage error:', error);
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
      const { content, totalTokens } = await this.callAPIWithUsage(prompt, {
        temperature: 0.7,
        maxTokens: this.config.maxTokens
      });

      logUsage(this._currentUserId, 'draft', totalTokens);

      return this.parseDraftResponse(content);
    } catch (error: any) {
      console.error('OpenAI draft generation error:', error);
      throw new Error(`Failed to generate draft: ${error.message}`);
    }
  }

  /**
   * メッセージをADHD向けに柔らかく変換・要約（LINEBOTがユーザーに語りかける形式）
   */
  async softenMessage(
    context: MessageContext,
    senderName?: string,
    triageType?: 'A' | 'B' | 'C',
    draftReply?: string
  ): Promise<string> {
    const prompt = buildSoftenPrompt(context, senderName, triageType, draftReply);

    try {
      const { content, totalTokens } = await this.callAPIWithUsage(prompt, {
        temperature: 0.75,
        maxTokens: 600
      });

      logUsage(this._currentUserId, 'soften', totalTokens);

      return this.parseDraftResponse(content);
    } catch (error: any) {
      console.error('OpenAI soften message error:', error);
      return context.body;
    }
  }

  /**
   * OpenAI APIを呼び出し（利用量情報付き）
   */
  private async callAPIWithUsage(
    prompt: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<{ content: string; totalTokens: number }> {
    const content = await this.callAPI(prompt, options);
    // callAPIでは直接トークン数を取れないため、_lastTotalTokensを参照
    return { content, totalTokens: this._lastTotalTokens };
  }

  private _lastTotalTokens: number = 0;

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

        // デバッグ用: レスポンスの詳細をログに出力
        if (process.env.NODE_ENV !== 'production') {
          console.log('[OpenAI API Response]', {
            model: response.model,
            choicesCount: response.choices?.length || 0,
            finishReason: response.choices[0]?.finish_reason,
            hasContent: !!response.choices[0]?.message?.content,
            contentLength: response.choices[0]?.message?.content?.length || 0
          });
        }

        // トークン使用量を保存
        this._lastTotalTokens = response.usage?.total_tokens ?? 0;

        const content = response.choices[0]?.message?.content;
        if (!content) {
          const finishReason = response.choices[0]?.finish_reason;
          const errorMsg = finishReason === 'length' 
            ? 'Response was truncated due to max_tokens limit'
            : finishReason === 'content_filter'
            ? 'Response was filtered by content filter'
            : `Empty response from OpenAI (finish_reason: ${finishReason || 'unknown'})`;
          throw new Error(errorMsg);
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
          // 401エラー（認証エラー）の場合は緊急通知を送信
          if (error.status === 401) {
            try {
              const { notifyApiTokenExpired } = await import('../utils/emergency-notification');
              await notifyApiTokenExpired('OpenAI', error.message || 'Unauthorized');
            } catch (notifyError) {
              console.error('Failed to send emergency notification:', notifyError);
            }
          }
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

