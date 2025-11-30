/**
 * LINEアクションハンドラー
 */
import { getSupabase, isSupabaseAvailable } from '../db/client';
import { sendGmailMessage } from './gmail';
import { sendChatworkMessage } from './chatwork';
import { sendTextMessage } from './line';

/**
 * メッセージ情報を取得
 */
async function getMessage(messageId: string): Promise<any | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error || !data) {
      console.error('[メッセージ取得失敗]', { messageId, error });
      return null;
    }

    return data;
  } catch (error: any) {
    console.error('[メッセージ取得エラー]', { messageId, error: error.message });
    return null;
  }
}

/**
 * メッセージステータスを更新
 */
async function updateMessageStatus(
  messageId: string,
  status: 'pending' | 'notified' | 'sent' | 'dismissed' | 'read' | 'snoozed',
  actionedAt?: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    return false;
  }

  try {
    const updateData: any = {
      status,
      actioned_at: actionedAt || new Date().toISOString()
    };

    const { error } = await (supabase.from('messages') as any)
      .update(updateData)
      .eq('id', messageId);

    if (error) {
      console.error('[ステータス更新失敗]', { messageId, status, error });
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('[ステータス更新エラー]', { messageId, status, error: error.message });
    return false;
  }
}

/**
 * LINEアクションを処理
 */
export async function handleLineAction(
  userId: string,
  actionData: string
): Promise<void> {
  try {
    // アクションデータをパース
    const params = new URLSearchParams(actionData);
    const action = params.get('action');
    const messageId = params.get('message_id');

    console.log('[アクション処理開始]', { userId, action, messageId });

    if (!action || !messageId) {
      console.error('[アクション処理失敗] パラメータ不足', { action, messageId });
      await sendTextMessage(userId, 'エラー: アクション情報が不正です。');
      return;
    }

    // メッセージ情報を取得
    const message = await getMessage(messageId);
    if (!message) {
      console.error('[アクション処理失敗] メッセージが見つかりません', { messageId });
      await sendTextMessage(userId, 'エラー: メッセージが見つかりませんでした。');
      return;
    }

    if (action === 'send') {
      // 送信処理
      await handleSendAction(userId, message);
    } else if (action === 'edit') {
      // 編集処理（ドラフト再生成）
      await handleEditAction(userId, message);
    } else if (action === 'dismiss') {
      // 却下処理
      await handleDismissAction(userId, message);
    } else {
      console.error('[アクション処理失敗] 不明なアクション', { action });
      await sendTextMessage(userId, `エラー: 不明なアクション「${action}」です。`);
    }
  } catch (error: any) {
    console.error('[アクション処理エラー]', { userId, actionData, error: error.message });
    await sendTextMessage(userId, 'エラー: アクション処理中にエラーが発生しました。');
  }
}

/**
 * 送信アクションを処理
 */
async function handleSendAction(userId: string, message: any): Promise<void> {
  try {
    const sourceType = message.source_type;
    const draft = message.body_plain || message.extracted_content || '';

    if (!draft) {
      await sendTextMessage(userId, 'エラー: 送信する内容がありません。');
      return;
    }

    let success = false;

    if (sourceType === 'gmail') {
      // Gmailで送信
      const threadId = message.thread_id;
      const senderIdentifier = message.sender_identifier || '';
      
      // メールアドレスを抽出（簡易版）
      const emailMatch = senderIdentifier.match(/<(.+)>/);
      const toEmail = emailMatch ? emailMatch[1] : senderIdentifier;

      if (!toEmail || !toEmail.includes('@')) {
        await sendTextMessage(userId, 'エラー: 送信先メールアドレスが取得できませんでした。');
        return;
      }

      const subject = message.subject ? `Re: ${message.subject}` : 'Re: ';
      success = await sendGmailMessage(toEmail, subject, draft, threadId || undefined);
    } else if (sourceType === 'chatwork') {
      // Chatworkで送信
      const roomId = message.metadata?.room_id;
      
      if (!roomId) {
        await sendTextMessage(userId, 'エラー: ルームIDが取得できませんでした。');
        return;
      }

      success = await sendChatworkMessage(roomId, draft);
    } else if (sourceType === 'line_forward') {
      // LINE転送の場合は送信できない
      await sendTextMessage(userId, 'LINE転送メッセージは送信できません。元のチャネルで返信してください。');
      return;
    } else {
      await sendTextMessage(userId, `エラー: 未対応のソースタイプ「${sourceType}」です。`);
      return;
    }

    if (success) {
      // ステータスを更新
      await updateMessageStatus(message.id, 'sent');
      await sendTextMessage(userId, '✅ 返信を送信しました。');
      console.log('[送信アクション完了]', { messageId: message.id, sourceType });
    } else {
      await sendTextMessage(userId, '❌ 送信に失敗しました。もう一度お試しください。');
    }
  } catch (error: any) {
    console.error('[送信アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 送信処理中にエラーが発生しました。');
  }
}

/**
 * 編集アクションを処理（ドラフト再生成）
 */
async function handleEditAction(userId: string, message: any): Promise<void> {
  try {
    await sendTextMessage(userId, '編集機能は現在開発中です。\n\n返信案を修正したい場合は、新しいメッセージを転送してください。');
    
    // TODO: 将来的にドラフト再生成機能を実装
    // const newDraft = await generateDraft(...);
    // await sendTextMessage(userId, `新しい返信案:\n\n${newDraft}`);
    
    console.log('[編集アクション完了]', { messageId: message.id });
  } catch (error: any) {
    console.error('[編集アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 編集処理中にエラーが発生しました。');
  }
}

/**
 * 却下アクションを処理
 */
async function handleDismissAction(userId: string, message: any): Promise<void> {
  try {
    // ステータスを更新
    const success = await updateMessageStatus(message.id, 'dismissed');

    if (success) {
      await sendTextMessage(userId, '✅ 返信を却下しました。');
      console.log('[却下アクション完了]', { messageId: message.id });
    } else {
      await sendTextMessage(userId, '❌ 却下処理に失敗しました。');
    }
  } catch (error: any) {
    console.error('[却下アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 却下処理中にエラーが発生しました。');
  }
}




