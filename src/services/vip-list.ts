/**
 * VIPリスト管理サービス
 *
 * 重要な送信者を登録しておくと、AIのトリアージ結果に関わらず
 * 常にType A（要返信）として通知する機能
 */
import { getSupabase } from '../db/client';

/**
 * VIPリストに送信者を追加
 */
export async function addVip(
  userId: string,
  senderIdentifier: string,
  label?: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('[VIPリスト] Supabaseが利用できません');
    return false;
  }

  try {
    const { error } = await (supabase.from('vip_entries') as any).insert({
      user_id: userId,
      sender_identifier: senderIdentifier.toLowerCase().trim(),
      label: label || null
    });

    if (error) {
      if (error.code === '23505') {
        // 既に登録済み → 成功扱い
        console.log(`[VIPリスト] 既に登録済み: ${senderIdentifier}`);
        return true;
      }
      console.error('[VIPリスト] 追加エラー:', error);
      return false;
    }

    console.log(`[VIPリスト] 追加: ${senderIdentifier}`);
    return true;
  } catch (error) {
    console.error('[VIPリスト] 追加例外:', error);
    return false;
  }
}

/**
 * VIPリストから送信者を削除
 */
export async function removeVip(
  userId: string,
  senderIdentifier: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('[VIPリスト] Supabaseが利用できません');
    return false;
  }

  try {
    const { error } = await (supabase.from('vip_entries') as any)
      .delete()
      .eq('user_id', userId)
      .eq('sender_identifier', senderIdentifier.toLowerCase().trim());

    if (error) {
      console.error('[VIPリスト] 削除エラー:', error);
      return false;
    }

    console.log(`[VIPリスト] 削除: ${senderIdentifier}`);
    return true;
  } catch (error) {
    console.error('[VIPリスト] 削除例外:', error);
    return false;
  }
}

/**
 * 送信者がVIPかどうかチェック（部分一致）
 * from headerには "名前 <email@example.com>" 形式が含まれる可能性があるため
 * VIPに登録された識別子がfromヘッダーに含まれるかで判定する
 */
export async function isVip(
  userId: string,
  fromHeader: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  try {
    const { data, error } = await (supabase.from('vip_entries') as any)
      .select('sender_identifier')
      .eq('user_id', userId);

    if (error || !data || data.length === 0) {
      return false;
    }

    const fromLower = fromHeader.toLowerCase();
    for (const row of data as Array<{ sender_identifier: string }>) {
      if (fromLower.includes(row.sender_identifier)) {
        console.log(`[VIPリスト] VIP送信者を検出: ${row.sender_identifier}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[VIPリスト] チェック例外:', error);
    return false;
  }
}

/**
 * VIPリスト一覧を取得
 */
export async function listVips(
  userId: string
): Promise<Array<{ sender_identifier: string; label: string | null }>> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await (supabase.from('vip_entries') as any)
      .select('sender_identifier, label')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[VIPリスト] 一覧取得エラー:', error);
      return [];
    }

    return (data || []) as Array<{ sender_identifier: string; label: string | null }>;
  } catch (error) {
    console.error('[VIPリスト] 一覧取得例外:', error);
    return [];
  }
}

/**
 * VIPリストの件数を取得（Freeプラン制限チェック用）
 */
export async function countVips(userId: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    return 0;
  }

  try {
    const { count, error } = await (supabase.from('vip_entries') as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('[VIPリスト] 件数取得エラー:', error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error('[VIPリスト] 件数取得例外:', error);
    return 0;
  }
}
