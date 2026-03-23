/**
 * LINEアクションハンドラー
 */
import { getSupabase, isSupabaseAvailable } from '../db/client';
import { sendGmailMessage } from './gmail';
import { sendChatworkMessage } from './chatwork';
import { sendSlackMessage } from './slack';
import { sendTextMessage, sendFlexMessage } from './line';
import { addToBlocklist, getBlocklist } from './blocklist';
import { getOpenAIProvider } from '../ai/openai';
import type { MessageContext } from '../ai/provider';
import { startEditMode, endEditMode } from './edit-mode';
import { snoozeMessage } from './snooze';

const LINE_TEXT_CHUNK_SIZE = 4200;
const LINE_SEND_INTERVAL_MS = 500;

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

async function getSlackInstallation(installationId: string, lineUserId: string): Promise<any | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    return null;
  }

  try {
    const { data, error } = await (supabase.from('slack_installations') as any)
      .select('*')
      .eq('id', installationId)
      .eq('line_user_id', lineUserId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('[Slack installation lookup failed]', { installationId, lineUserId, error });
      return null;
    }

    return data;
  } catch (error: any) {
    console.error('[Slack installation lookup error]', {
      installationId,
      lineUserId,
      error: error.message
    });
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

function splitTextByLength(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

async function sendChunkedTextMessage(userId: string, text: string): Promise<void> {
  const chunks = splitTextByLength(text, LINE_TEXT_CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = `${chunks[i]}${i < chunks.length - 1 ? '\n\n（続く）' : ''}`;
    const ok = await sendTextMessage(userId, chunk);
    if (!ok) {
      throw new Error('Failed to send LINE text message');
    }
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, LINE_SEND_INTERVAL_MS));
    }
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
    } else if (action === 'view_received' || action === 'view_original') {
      // 受信文確認処理
      await handleViewReceivedAction(userId, message);
    } else if (action === 'view_draft' || action === 'view_reply') {
      // 返信文確認処理
      await handleViewDraftAction(userId, message);
    } else if (action === 'edit') {
      // 編集トーン選択画面を表示
      await handleEditAction(userId, message);
    } else if (action === 'edit_regenerate') {
      // 選択されたトーンでドラフト再生成
      const tone = params.get('tone') as 'formal' | 'casual' | 'brief' | null;
      await handleEditRegenerateAction(userId, message, tone || 'formal');
    } else if (action === 'edit_custom') {
      // カスタム修正モード開始
      await handleCustomEditAction(userId, message);
    } else if (action === 'dismiss') {
      // 却下処理
      await handleDismissAction(userId, message);
    } else if (action === 'read') {
      // 既読処理
      await handleReadAction(userId, message);
    } else if (action === 'acknowledge' || action === 'ack') {
      // 確認メール送信処理
      await handleAcknowledgeAction(userId, message);
    } else if (action === 'snooze') {
      // スヌーズ処理
      const durationParam = params.get('duration');
      const durationMinutes = durationParam ? parseInt(durationParam, 10) : 120;
      await handleSnoozeAction(userId, message, durationMinutes);
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
    } else if (sourceType === 'slack') {
      const installationId = message.metadata?.installation_id;
      const channelId = message.metadata?.channel_id;
      const threadTs = message.metadata?.thread_ts || message.metadata?.slack_ts;

      if (!installationId || !channelId) {
        await sendTextMessage(userId, 'エラー: Slack送信先情報が取得できませんでした。');
        return;
      }

      const installation = await getSlackInstallation(installationId, userId);
      if (!installation?.user_access_token) {
        await sendTextMessage(userId, 'エラー: Slack連携情報が見つかりませんでした。再連携してください。');
        return;
      }

      await sendSlackMessage(installation.user_access_token, channelId, draft, threadTs || undefined);
      success = true;
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
    
    const text =
      `📝 返信文（全文）\n\n` +
      `【件名】\nRe: ${subject}\n\n` +
      `【送信先】\n${sender}\n\n` +
      `【返信文】\n${draft}`;
    await sendChunkedTextMessage(userId, text);
    
    console.log('[返信文確認アクション完了]', { messageId: message.id, draftLength: draft.length });
  } catch (error: any) {
    console.error('[返信文確認アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 返信文の取得中にエラーが発生しました。');
  }
}

/**
 * 受信文確認アクションを処理
 */
async function handleViewReceivedAction(userId: string, message: any): Promise<void> {
  try {
    const originalBody =
      (typeof message.body_plain === 'string' && message.body_plain.trim()) ||
      (typeof message.extracted_content === 'string' && message.extracted_content.trim()) ||
      (typeof message.body === 'string' && message.body.trim()) ||
      '';

    if (!originalBody) {
      await sendTextMessage(userId, '❌ 受信文が見つかりませんでした。');
      return;
    }

    const subject = message.subject || '（件名なし）';
    const sender = message.sender_identifier || message.sender_name || '送信者不明';
    const sourceType = message.source_type || 'unknown';

    const header =
      `📩 受信文（全文）\n\n` +
      `【送信元】\n${sender}\n\n` +
      `【チャネル】\n${sourceType}\n\n` +
      `【件名】\n${subject}\n\n` +
      `【本文】\n`;

    await sendChunkedTextMessage(userId, `${header}${originalBody}`);

    console.log('[受信文確認アクション完了]', { messageId: message.id, bodyLength: originalBody.length });
  } catch (error: any) {
    console.error('[受信文確認アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 受信文の取得中にエラーが発生しました。');
  }
}

/**
 * 編集アクションを処理（トーン選択画面を表示）
 */
async function handleEditAction(userId: string, message: any): Promise<void> {
  try {
    const messageId = message.id;
    const subject = message.subject || '（件名なし）';
    
    // トーン選択用のFlexメッセージを送信
    const flexContents = createToneSelectionFlexMessage(messageId, subject);
    await sendFlexMessage(userId, {
      type: 'flex',
      altText: '返信文のトーンを選択',
      contents: flexContents
    });
    
    console.log('[編集アクション完了]', { messageId: message.id });
  } catch (error: any) {
    console.error('[編集アクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: 編集処理中にエラーが発生しました。');
  }
}

/**
 * トーン選択用のFlexメッセージを作成
 */
function createToneSelectionFlexMessage(messageId: string, subject: string): any {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✏️ 返信文を再生成',
          weight: 'bold',
          size: 'md',
          color: '#1a1a1a'
        }
      ],
      paddingAll: 'lg',
      backgroundColor: '#f5f5f5'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: subject.length > 30 ? subject.substring(0, 30) + '...' : subject,
          size: 'sm',
          color: '#666666',
          wrap: true
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'text',
          text: 'どのトーンで再生成しますか？',
          size: 'sm',
          color: '#1a1a1a',
          margin: 'lg'
        }
      ],
      paddingAll: 'lg'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '📝 フォーマル（丁寧）',
            data: `action=edit_regenerate&message_id=${messageId}&tone=formal`,
            displayText: 'フォーマルなトーンで再生成'
          },
          style: 'primary',
          height: 'sm',
          color: '#4A90A4'
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '💬 カジュアル（親しみ）',
            data: `action=edit_regenerate&message_id=${messageId}&tone=casual`,
            displayText: 'カジュアルなトーンで再生成'
          },
          style: 'primary',
          height: 'sm',
          margin: 'sm',
          color: '#5BA88B'
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '⚡ 簡潔（短め）',
            data: `action=edit_regenerate&message_id=${messageId}&tone=brief`,
            displayText: '簡潔なトーンで再生成'
          },
          style: 'primary',
          height: 'sm',
          margin: 'sm',
          color: '#D4A574'
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '🔧 カスタム修正（日付・数字など）',
            data: `action=edit_custom&message_id=${messageId}`,
            displayText: 'カスタム修正モードを開始'
          },
          style: 'secondary',
          height: 'sm',
          margin: 'lg'
        }
      ],
      paddingAll: 'lg',
      spacing: 'none'
    }
  };
}

/**
 * ドラフト再生成アクションを処理
 */
async function handleEditRegenerateAction(
  userId: string, 
  message: any, 
  tone: 'formal' | 'casual' | 'brief'
): Promise<void> {
  try {
    // 処理中メッセージを送信
    const toneLabels: Record<string, string> = {
      formal: 'フォーマル',
      casual: 'カジュアル', 
      brief: '簡潔'
    };
    await sendTextMessage(userId, `⏳ ${toneLabels[tone]}トーンで返信文を再生成中...`);

    // メッセージコンテキストを作成
    const context: MessageContext = {
      subject: message.subject || '',
      body: message.body_plain || message.body || '',
      senderName: message.sender_identifier || message.sender_name || '',
      sourceType: message.source_type || 'gmail'
    };

    // トリアージタイプを取得
    const triageType = message.triage_type || 'B';

    // AIプロバイダーでドラフト再生成
    const aiProvider = getOpenAIProvider();
    const newDraft = await aiProvider.generateDraft(context, triageType, tone);

    if (!newDraft) {
      await sendTextMessage(userId, '❌ 返信文の再生成に失敗しました。もう一度お試しください。');
      return;
    }

    // DBのdraft_replyを更新
    const supabase = getSupabase();
    if (supabase && isSupabaseAvailable()) {
      await (supabase.from('messages') as any)
        .update({ draft_reply: newDraft })
        .eq('id', message.id);
    }

    // 再生成した返信文を表示（長文は分割）
    const subject = message.subject || '（件名なし）';
    const sender = message.sender_identifier || message.sender_name || '送信者不明';
    const regeneratedText =
      `✅ ${toneLabels[tone]}トーンで再生成しました！\n\n` +
      `【件名】\nRe: ${subject}\n\n` +
      `【送信先】\n${sender}\n\n` +
      `【新しい返信文】\n${newDraft}`;
    await sendChunkedTextMessage(userId, regeneratedText);

    // 送信ボタン付きのFlexメッセージを送信
    const confirmFlexContents = createRegenerateConfirmFlexMessage(message.id);
    await sendFlexMessage(userId, {
      type: 'flex',
      altText: '返信文の操作',
      contents: confirmFlexContents
    });

    console.log('[ドラフト再生成完了]', { 
      messageId: message.id, 
      tone,
      draftLength: newDraft.length 
    });
  } catch (error: any) {
    console.error('[ドラフト再生成エラー]', { 
      userId, 
      messageId: message.id, 
      tone,
      error: error.message 
    });
    await sendTextMessage(userId, 'エラー: 返信文の再生成中にエラーが発生しました。');
  }
}

/**
 * カスタム修正アクションを処理（編集モード開始）
 */
async function handleCustomEditAction(userId: string, message: any): Promise<void> {
  try {
    const currentDraft = message.draft_reply;
    
    if (!currentDraft) {
      await sendTextMessage(userId, '❌ 返信文が見つかりませんでした。\n\n先に返信文を生成してからカスタム修正をお試しください。');
      return;
    }

    // 編集モードを開始
    const success = await startEditMode(userId, message.id, currentDraft);
    
    if (!success) {
      await sendTextMessage(userId, 'エラー: カスタム修正モードを開始できませんでした。');
      return;
    }

    // ユーザーに説明と現在の返信文を表示
    const draftPreview = currentDraft.length > 200 
      ? currentDraft.substring(0, 200) + '...' 
      : currentDraft;
    
    await sendTextMessage(userId, 
      `🔧 **カスタム修正モード開始**\n\n` +
      `【現在の返信文】\n${draftPreview}\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `修正したい内容をLINEで送信してください。\n\n` +
      `📝 **例:**\n` +
      `・「日付を12/15に変更」\n` +
      `・「金額を50,000円に」\n` +
      `・「名前を田中様に」\n` +
      `・「もっと丁寧な言い方に」\n\n` +
      `⏰ 5分以内に入力してください。\n` +
      `キャンセルする場合は「キャンセル」と入力。`
    );

    console.log('[カスタム修正モード開始]', { messageId: message.id, userId });
  } catch (error: any) {
    console.error('[カスタム修正エラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: カスタム修正モードの開始中にエラーが発生しました。');
  }
}

/**
 * 再生成後の確認用Flexメッセージを作成
 */
function createRegenerateConfirmFlexMessage(messageId: string): any {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'この返信文でよろしいですか？',
          size: 'sm',
          color: '#666666'
        }
      ],
      paddingAll: 'lg'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '📝 返信文確認',
            data: `action=view_draft&message_id=${messageId}`,
            displayText: '返信文を確認します'
          },
          style: 'secondary',
          height: 'sm'
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
            label: '✉️ 送信',
            data: `action=send&message_id=${messageId}`,
            displayText: 'この返信文を送信'
              },
              style: 'primary',
              height: 'sm',
              color: '#4A90A4',
              flex: 1
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: '✏️ 再修正',
                data: `action=edit&message_id=${messageId}`,
                displayText: '別のトーンで再生成'
              },
              style: 'secondary',
              height: 'sm',
              flex: 1,
              margin: 'sm'
            }
          ],
          margin: 'sm'
        }
      ],
      paddingAll: 'lg',
      spacing: 'sm'
    }
  };
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

/**
 * 編集モード中のテキストメッセージを処理
 */
export async function handleEditModeMessage(
  userId: string,
  instruction: string,
  editModeData: { messageId: string; currentDraft: string }
): Promise<boolean> {
  try {
    // キャンセルチェック
    if (instruction.trim() === 'キャンセル' || instruction.trim() === 'cancel') {
      await endEditMode(userId);
      await sendTextMessage(userId, '✅ カスタム修正をキャンセルしました。');
      return true;
    }

    await sendTextMessage(userId, '⏳ 修正内容を反映中...');

    // メッセージを取得
    const message = await getMessage(editModeData.messageId);
    if (!message) {
      await endEditMode(userId);
      await sendTextMessage(userId, 'エラー: メッセージが見つかりませんでした。');
      return true;
    }

    // AIに修正指示を渡して返信文を更新
    const modifiedDraft = await applyCustomEdit(
      editModeData.currentDraft,
      instruction
    );

    if (!modifiedDraft) {
      await sendTextMessage(userId, '❌ 修正の適用に失敗しました。もう一度お試しください。');
      return true;
    }

    // DBのdraft_replyを更新
    const supabase = getSupabase();
    if (supabase && isSupabaseAvailable()) {
      await (supabase.from('messages') as any)
        .update({ draft_reply: modifiedDraft })
        .eq('id', editModeData.messageId);
    }

    // 編集モードを終了
    await endEditMode(userId);

    // 修正後の返信文を表示（長文は分割）
    const subject = message.subject || '（件名なし）';
    const sender = message.sender_identifier || message.sender_name || '送信者不明';
    const editedText =
      `✅ 修正を適用しました！\n\n` +
      `【件名】\nRe: ${subject}\n\n` +
      `【送信先】\n${sender}\n\n` +
      `【修正後の返信文】\n${modifiedDraft}`;
    await sendChunkedTextMessage(userId, editedText);

    // 送信ボタン付きのFlexメッセージを送信
    const confirmFlexContents = createRegenerateConfirmFlexMessage(editModeData.messageId);
    await sendFlexMessage(userId, {
      type: 'flex',
      altText: '返信文の操作',
      contents: confirmFlexContents
    });

    console.log('[カスタム修正完了]', { 
      messageId: editModeData.messageId, 
      instruction,
      draftLength: modifiedDraft.length 
    });

    return true;
  } catch (error: any) {
    console.error('[編集モード処理エラー]', { userId, error: error.message });
    await endEditMode(userId);
    await sendTextMessage(userId, 'エラー: 修正処理中にエラーが発生しました。');
    return true;
  }
}

/**
 * AIに修正指示を適用してドラフトを更新
 */
async function applyCustomEdit(
  currentDraft: string,
  instruction: string
): Promise<string | null> {
  try {
    // OpenAI clientを直接作成
    const OpenAI = (await import('openai')).default;
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('[カスタム編集エラー] OPENAI_API_KEYが設定されていません');
      return null;
    }
    
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // カスタム編集用のプロンプトを作成
    const prompt = `以下の返信文に対して、ユーザーの指示に従って修正してください。

【現在の返信文】
${currentDraft}

【修正指示】
${instruction}

【ルール】
1. 指示された部分のみを修正し、それ以外は元の文章を維持する
2. 文体や敬語のレベルは元の文章に合わせる
3. 修正後の返信文のみを出力する（説明は不要）

【修正後の返信文】`;

    // OpenAI APIを呼び出す
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'あなたはビジネスメールの修正アシスタントです。ユーザーの指示に従って返信文を修正します。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    return content?.trim() || null;
  } catch (error: any) {
    console.error('[カスタム編集エラー]', error.message);
    return null;
  }
}

/**
 * スヌーズアクションを処理
 */
async function handleSnoozeAction(userId: string, message: any, durationMinutes: number): Promise<void> {
  try {
    const success = await snoozeMessage(message.id, durationMinutes);

    if (success) {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const durationLabel = hours > 0
        ? (minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`)
        : `${minutes}分`;
      await sendTextMessage(userId, `⏰ ${durationLabel}後にリマインドします`);
      console.log('[スヌーズアクション完了]', { messageId: message.id, durationMinutes });
    } else {
      await sendTextMessage(userId, '❌ スヌーズの設定に失敗しました。');
    }
  } catch (error: any) {
    console.error('[スヌーズアクションエラー]', { userId, messageId: message.id, error: error.message });
    await sendTextMessage(userId, 'エラー: スヌーズ処理中にエラーが発生しました。');
  }
}
