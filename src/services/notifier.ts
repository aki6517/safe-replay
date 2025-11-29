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
    // 通知メッセージを構築
    let notificationText = '';
    
    if (triageType === 'A') {
      // Type A: 件名 + 本文 + 返信案
      notificationText = `【重要メッセージ】\n\n`;
      if (message.subject) {
        notificationText += `件名: ${message.subject}\n`;
      }
      notificationText += `送信元: ${message.sender} (${message.source})\n\n`;
      notificationText += `--- メッセージ内容 ---\n${message.body}\n\n`;
      if (draft) {
        notificationText += `--- 返信案 ---\n${draft}`;
      }
    } else if (triageType === 'B') {
      // Type B: 件名 + 本文のみ
      notificationText = `【メッセージ受信】\n\n`;
      if (message.subject) {
        notificationText += `件名: ${message.subject}\n`;
      }
      notificationText += `送信元: ${message.sender} (${message.source})\n\n`;
      notificationText += `--- メッセージ内容 ---\n${message.body}`;
    }

    // LINEメッセージを送信
    const success = await sendTextMessage(userId, notificationText);
    
    if (success) {
      // DBに通知履歴を記録
      await recordNotification(messageId, triageType);
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
 * @param triageType - トリアージタイプ
 */
async function recordNotification(
  messageId: string,
  triageType: TriageType
): Promise<void> {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('messages')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString()
      })
      .eq('id', messageId);

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

