/**
 * LINE通知サービス
 */
import { sendTextMessage, isLineClientAvailable } from './line';
import { getSupabase } from '../db/client';
import type { TriageType } from '../types/triage';

/**
 * LINE通知送信
 * 
 * @param userId - LINE User ID
 * @param messageId - メッセージID（DBのUUID）
 * @param triageType - トリアージタイプ（A/B/C）
 * @param message - メッセージ情報
 * @param draft - 返信ドラフト（Type Aの場合のみ）
 * @returns 成功時true、失敗時false
 */
export async function sendLineNotification(
  userId: string,
  messageId: string,
  triageType: TriageType,
  message: {
    subject?: string;
    body: string;
    sender: string;
    source: string;
  },
  draft?: string
): Promise<boolean> {
  // Type Cは通知しない（ログのみ）
  if (triageType === 'C') {
    console.log('[Type C] 通知スキップ:', {
      userId,
      messageId,
      sender: message.sender,
      source: message.source
    });
    return true;
  }

  // LINEクライアントが利用可能かチェック
  if (!isLineClientAvailable()) {
    console.error('LINE Messaging API credentials not configured');
    return false;
  }

  try {
    let success = false;
    
    if (triageType === 'A') {
      // Type A: Flex Messageを使用
      if (draft) {
        const { createTypeAFlexMessage } = await import('./flex-messages/type-a');
        const { sendFlexMessage } = await import('./line');
        
        const flexMessage = createTypeAFlexMessage({
          messageId,
          subject: message.subject,
          body: message.body,
          sender: message.sender,
          source: message.source,
          draft
        });
        
        // デバッグ用: Flex MessageのJSONを出力（開発環境のみ）
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Flex Message JSON]', JSON.stringify(flexMessage, null, 2));
        }
        
        success = await sendFlexMessage(userId, flexMessage);
      } else {
        // ドラフトがない場合はテキストメッセージを送信
        let notificationText = `【重要メッセージ】\n\n`;
        if (message.subject) {
          notificationText += `件名: ${message.subject}\n`;
        }
        notificationText += `送信元: ${message.sender} (${message.source})\n\n`;
        notificationText += `--- メッセージ内容 ---\n${message.body}`;
        success = await sendTextMessage(userId, notificationText);
      }
    } else if (triageType === 'B') {
      // Type B: Flex Messageを使用（静音通知）
      const { createTypeBFlexMessage } = await import('./flex-messages/type-b');
      const { sendFlexMessage } = await import('./line');
      
      const flexMessage = createTypeBFlexMessage({
        messageId,
        subject: message.subject,
        body: message.body,
        sender: message.sender,
        source: message.source,
        draft // 返信案も渡す
      });
      
      // デバッグ用: Flex MessageのJSONを出力（開発環境のみ）
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Flex Message JSON]', JSON.stringify(flexMessage, null, 2));
      }
      
      // 静音通知で送信（通知音を無効化）
      success = await sendFlexMessage(userId, flexMessage, {
        notificationDisabled: true
      });
    }
    
    if (success) {
      // DBに通知履歴を記録
      await recordNotification(messageId);
      console.log('[通知送信成功]', {
        userId,
        messageId,
        triageType,
        source: message.source
      });
    } else {
      console.error('[通知送信失敗]', {
        userId,
        messageId,
        triageType
      });
    }

    return success;
  } catch (error: any) {
    console.error('[通知送信エラー]', {
      userId,
      messageId,
      triageType,
      error: error.message
    });
    return false;
  }
}

/**
 * 通知履歴をDBに記録
 * 
 * @param messageId - メッセージID
 */
async function recordNotification(
  messageId: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    
    // Supabase型定義の問題を回避（messagesテーブルのupdate型が正しく推論されない）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const updateQuery: any = (supabase as any)
      .from('messages')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { error } = await updateQuery;

    if (error) {
      console.error('[通知履歴記録エラー]', {
        messageId,
        error: error.message
      });
      throw error;
    }
  } catch (error: any) {
    console.error('[通知履歴記録エラー]', {
      messageId,
      error: error.message
    });
    // エラーが発生しても通知送信自体は成功しているので、エラーを再スローしない
  }
}

