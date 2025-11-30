/**
 * メッセージ処理サービス
 */
import { getSupabase, isSupabaseAvailable } from '../db/client';
import { triageMessage } from '../ai/triage';
import { generateDraft } from '../ai/draft';
import { sendLineNotification } from './notifier';

/**
 * LINE User IDからusersテーブルのUUIDを取得（存在しない場合は作成）
 */
async function getOrCreateUser(lineUserId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    // 既存ユーザーを検索
    const searchResult: any = await supabase
      .from('users')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    if (searchResult.data && !searchResult.error) {
      return searchResult.data.id;
    }

    // ユーザーが存在しない場合は作成
    const insertResult: any = await (supabase.from('users') as any).insert({
      line_user_id: lineUserId,
      is_active: true
    }).select('id').single();

    if (insertResult.error || !insertResult.data) {
      console.error('Failed to create user:', insertResult.error);
      return null;
    }

    return insertResult.data.id;
  } catch (error: any) {
    console.error('Failed to get or create user:', error);
    return null;
  }
}

/**
 * 転送メッセージを処理
 * 
 * @param lineUserId - LINE User ID
 * @param text - 転送されたメッセージテキスト
 */
export async function processForwardedMessage(
  lineUserId: string,
  text: string
): Promise<void> {
  try {
    console.log('[転送メッセージ処理開始]', { lineUserId, textLength: text.length });

    // LINE User IDからusersテーブルのUUIDを取得
    const userId = await getOrCreateUser(lineUserId);
    if (!userId) {
      console.error('[転送メッセージ処理失敗] ユーザー取得に失敗しました');
      return;
    }

    // Supabaseクライアントを取得
    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      console.error('[転送メッセージ処理失敗] Supabaseクライアントが利用できません');
      return;
    }

    // 転送メッセージをDBに保存
    const insertData = {
      user_id: userId,
      source_type: 'line_forward' as const,
      source_message_id: `line_forward_${Date.now()}_${Math.random().toString(36).substring(7)}`, // 一意のIDを生成
      thread_id: null, // LINE転送にはスレッドIDがない
      sender_identifier: 'LINE転送', // 転送メッセージの送信元識別子
      sender_name: 'LINE転送',
      subject: null, // LINE転送には件名がない
      body_plain: text || null,
      extracted_content: text || null,
      received_at: new Date().toISOString(),
      status: 'pending' as const,
      metadata: {
        forwarded_from: lineUserId,
        forwarded_at: new Date().toISOString()
      } as Record<string, unknown>
    };

    const { data: insertedData, error: dbError } = await (supabase.from('messages') as any).insert(insertData).select().single();

    if (dbError) {
      console.error('[転送メッセージ処理失敗] DB保存エラー:', dbError);
      return;
    }

    const messageId = insertedData?.id;
    if (!messageId) {
      console.error('[転送メッセージ処理失敗] メッセージIDが取得できませんでした');
      return;
    }

    console.log('[転送メッセージ保存完了]', { messageId });

    // AIトリアージを実行（LINE転送にはスレッド履歴がない）
    try {
      const triageResult = await triageMessage(
        '', // LINE転送には件名がない
        text
      );

      console.log('[トリアージ結果]', { type: triageResult.type, confidence: triageResult.confidence });

      // トリアージ結果をDBに更新
      await (supabase.from('messages') as any).update({
        triage_type: triageResult.type,
        triage_reason: triageResult.reason,
        priority_score: triageResult.priority_score,
        ai_analysis: {
          confidence: triageResult.confidence,
          details: triageResult.details
        } as Record<string, unknown>
      }).eq('id', messageId);

      // Type A/Bの場合のみ通知（Type Cは通知しない）
      if (triageResult.type === 'A' || triageResult.type === 'B') {
        // Type Aの場合はドラフト生成
        let draft: string | undefined;
        if (triageResult.type === 'A') {
          try {
            draft = await generateDraft(
              '', // LINE転送には件名がない
              text,
              triageResult.type
            );
            console.log('[ドラフト生成完了]', { draftLength: draft.length });
          } catch (draftError: any) {
            console.warn('[ドラフト生成失敗]', draftError.message);
          }
        }

        // LINE通知を送信
        try {
          await sendLineNotification(
            lineUserId,
            messageId,
            triageResult.type,
            {
              subject: undefined, // LINE転送には件名がない
              body: text.substring(0, 500), // 最初の500文字のみ
              sender: 'LINE転送',
              source: 'LINE転送'
            },
            draft
          );
          console.log('[通知送信完了]', { messageId, triageType: triageResult.type });
        } catch (notifyError: any) {
          console.error('[通知送信失敗]', { messageId, error: notifyError.message });
        }
      } else {
        console.log('[Type C] 通知スキップ', { messageId });
      }
    } catch (triageError: any) {
      console.error('[トリアージ処理失敗]', { messageId, error: triageError.message });
    }
  } catch (error: any) {
    console.error('[転送メッセージ処理エラー]', { lineUserId, error: error.message });
  }
}

