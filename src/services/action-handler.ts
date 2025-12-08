/**
 * LINEアクションハンドラー
 */
import { getSupabase, isSupabaseAvailable } from '../db/client';
import { sendGmailMessage } from './gmail';
import { sendChatworkMessage } from './chatwork';
import { sendTextMessage } from './line';
import { addToBlocklist, getBlocklist } from './blocklist';

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
    } else if (action === 'view_draft' || action === 'view_reply') {
      // 返信文確認処理
      await handleViewDraftAction(userId, message);
    } else if (action === 'edit') {
      // 編集処理（ドラフト再生成）
      await handleEditAction(userId, message);
    } else if (action === 'dismiss') {
      // 却下処理
      await handleDismissAction(userId, message);
    } else if (action === 'read') {
      // 既読処理
      await handleReadAction(userId, message);
    } else if (action === 'acknowledge' || action === 'ack') {
      // 確認メール送信処理
      await handleAcknowledgeAction(userId, message);
    } else if (action === 'block') {
      // ブロック処理
      await handleBlockAction(userId, message);
    } else if (action === 'blocklist') {
      // ブロックリスト表示
      await handleBlocklistAction(userId);
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
    // draft_reply（AIが作成した返信文）を優先的に使用
    const draft = message.draft_reply;

    if (!draft) {
      await sendTextMessage(userId, 'エラー: 返信文が見つかりませんでした。\n\nAIが返信文を作成していない可能性があります。新しいメッセージを受信してお試しください。');
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
 * 返信文確認アクションを処理
 */
async function handleViewDraftAction(userId: string, message: any): Promise<void> {
  try {
    // 返信文を取得（draft_replyのみを使用）
    const draft = message.draft_reply;
    
    if (!draft) {
      await sendTextMessage(userId, '❌ 返信文が見つかりませんでした。\n\nこのメッセージはAIが返信文を作成する前に処理されたか、返信文の生成に失敗した可能性があります。\n\n新しいメッセージを受信してお試しください。');
      return;
    }

    // 件名を取得
    const subject = message.subject || '（件名なし）';
    const sender = message.sender_identifier || message.sender_name || '送信者不明';
    
    // 返信文を表示（長い場合は分割）
    const maxLength = 5000; // LINEのメッセージ上限
    
    if (draft.length <= maxLength) {
      await sendTextMessage(userId, `📝 返信文（全文）\n\n【件名】\nRe: ${subject}\n\n【送信先】\n${sender}\n\n【返信文】\n${draft}`);
    } else {
      // 長い場合は分割して送信
      const chunks = [];
      for (let i = 0; i < draft.length; i += maxLength) {
        chunks.push(draft.substring(i, i + maxLength));
      }
      
      await sendTextMessage(userId, `📝 返信文（全文）\n\n【件名】\nRe: ${subject}\n\n【送信先】\n${sender}\n\n【返信文】`);
      for (let i = 0; i < chunks.length; i++) {
        await sendTextMessage(userId, `${chunks[i]}${i < chunks.length - 1 ? '\n\n（続く）' : ''}`);
        // レート制限を避けるため少し待機
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    console.log('[返信文確認アクション完了]', { messageId: message.id, draftLength: draft.length });
  } catch (error: any) {
    console.error('[返信文確認アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 返信文の取得中にエラーが発生しました。');
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

/**
 * 既読アクションを処理
 */
async function handleReadAction(userId: string, message: any): Promise<void> {
  try {
    // ステータスを更新
    const success = await updateMessageStatus(message.id, 'read');

    if (success) {
      await sendTextMessage(userId, '✅ 既読にしました。');
      console.log('[既読アクション完了]', { messageId: message.id });
    } else {
      await sendTextMessage(userId, '❌ 既読処理に失敗しました。');
    }
  } catch (error: any) {
    console.error('[既読アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 既読処理中にエラーが発生しました。');
  }
}

/**
 * 確認メール送信アクションを処理
 */
async function handleAcknowledgeAction(userId: string, message: any): Promise<void> {
  try {
    const sourceType = message.source_type;

    if (sourceType !== 'gmail') {
      await sendTextMessage(userId, '確認メールはGmailメッセージのみ送信できます。');
      return;
    }

    // 確認メールの本文を作成
    const subject = message.subject || '確認メール';
    const senderIdentifier = message.sender_identifier || '';
    
    // メールアドレスを抽出（簡易版）
    const emailMatch = senderIdentifier.match(/<(.+)>/);
    const toEmail = emailMatch ? emailMatch[1] : senderIdentifier;

    if (!toEmail || !toEmail.includes('@')) {
      await sendTextMessage(userId, 'エラー: 送信先メールアドレスが取得できませんでした。');
      return;
    }

    // 確認メールの本文
    const acknowledgeBody = `お世話になっております。

${subject}について、内容を確認いたしました。

引き続きよろしくお願いいたします。`;

    const threadId = message.thread_id;
    const replySubject = `Re: ${subject}`;
    const success = await sendGmailMessage(toEmail, replySubject, acknowledgeBody, threadId || undefined);

    if (success) {
      // ステータスを更新
      await updateMessageStatus(message.id, 'read');
      await sendTextMessage(userId, '✅ 確認メールを送信しました。');
      console.log('[確認メール送信完了]', { messageId: message.id, toEmail });
    } else {
      await sendTextMessage(userId, '❌ 確認メールの送信に失敗しました。もう一度お試しください。');
    }
  } catch (error: any) {
    console.error('[確認メール送信エラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 確認メール送信処理中にエラーが発生しました。');
  }
}

/**
 * ブロックアクションを処理
 */
async function handleBlockAction(userId: string, message: any): Promise<void> {
  try {
    const senderEmail = message.sender_identifier || '';
    
    if (!senderEmail) {
      await sendTextMessage(userId, 'エラー: 送信者のメールアドレスが取得できませんでした。');
      return;
    }

    // ユーザーIDを取得（DBのUUID）
    const supabase = getSupabase();
    if (!supabase) {
      await sendTextMessage(userId, 'エラー: データベースに接続できませんでした。');
      return;
    }

    // LINE User IDからDB User IDを取得
    const { data: userData } = await (supabase.from('users') as any)
      .select('id')
      .eq('line_user_id', userId)
      .single();

    if (!userData) {
      await sendTextMessage(userId, 'エラー: ユーザー情報が見つかりませんでした。');
      return;
    }

    const success = await addToBlocklist(userData.id as string, senderEmail);

    if (success) {
      // メールアドレスを抽出して表示
      const emailMatch = senderEmail.match(/<([^>]+)>/);
      const displayEmail = emailMatch ? emailMatch[1] : senderEmail;
      
      await sendTextMessage(userId, `🚫 ${displayEmail} をブロックしました。\n\nこのアドレスからのメールは今後通知されません。`);
      console.log('[ブロックアクション完了]', { messageId: message.id, senderEmail: displayEmail });
    } else {
      await sendTextMessage(userId, '❌ ブロック処理に失敗しました。');
    }
  } catch (error: any) {
    console.error('[ブロックアクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: ブロック処理中にエラーが発生しました。');
  }
}

/**
 * ブロックリスト表示アクションを処理
 */
async function handleBlocklistAction(userId: string): Promise<void> {
  try {
    // ユーザーIDを取得（DBのUUID）
    const supabase = getSupabase();
    if (!supabase) {
      await sendTextMessage(userId, 'エラー: データベースに接続できませんでした。');
      return;
    }

    // LINE User IDからDB User IDを取得
    const { data: userData } = await (supabase.from('users') as any)
      .select('id')
      .eq('line_user_id', userId)
      .single();

    if (!userData) {
      await sendTextMessage(userId, 'エラー: ユーザー情報が見つかりませんでした。');
      return;
    }

    const blockedEmails = await getBlocklist(userData.id as string);

    if (blockedEmails.length === 0) {
      await sendTextMessage(userId, '📋 ブロックリストは空です。\n\nメッセージの「🚫ブロック」ボタンを押すと、そのアドレスからの通知をブロックできます。');
    } else {
      const emailList = blockedEmails.map((email, index) => `${index + 1}. ${email}`).join('\n');
      await sendTextMessage(userId, `📋 ブロックリスト:\n\n${emailList}\n\n※ブロック解除は現在開発中です。`);
    }
    
    console.log('[ブロックリスト表示完了]', { userId, count: blockedEmails.length });
  } catch (error: any) {
    console.error('[ブロックリスト表示エラー]', { userId, error: error.message });
    await sendTextMessage(userId, 'エラー: ブロックリスト取得中にエラーが発生しました。');
  }
}




