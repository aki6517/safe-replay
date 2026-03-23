/**
 * スヌーズサービス
 *
 * メッセージを一時保留し、指定時間後にLINEでリマインドする機能。
 */
import { getSupabase } from '../db/client';

/**
 * メッセージをスヌーズ状態にする
 *
 * @param messageId - スヌーズするメッセージID
 * @param durationMinutes - スヌーズ時間（分）
 * @returns 成功時 true
 */
export async function snoozeMessage(messageId: string, durationMinutes: number): Promise<boolean> {
  const supabase = getSupabase();
  const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  const { error } = await (supabase.from('messages') as any)
    .update({ status: 'snoozed', snooze_until: snoozeUntil })
    .eq('id', messageId);
  if (error) {
    console.error('[スヌーズ設定失敗]', { messageId, durationMinutes, error });
    return false;
  }
  return true;
}

/**
 * 期限切れのスヌーズメッセージを取得する
 *
 * @returns 期限切れのスヌーズメッセージ一覧
 */
export async function getExpiredSnoozes(): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await (supabase.from('messages') as any)
    .select('id, user_id, source_type, sender_name, subject, body_plain, draft_reply, triage_type, metadata')
    .eq('status', 'snoozed')
    .lt('snooze_until', new Date().toISOString());
  if (error || !data) {
    if (error) {
      console.error('[期限切れスヌーズ取得失敗]', { error });
    }
    return [];
  }
  return data;
}
