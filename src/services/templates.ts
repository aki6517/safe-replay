/**
 * 返信テンプレート管理サービス（F-12）
 *
 * よく使う返信文を保存・呼び出しできる機能。
 * Freeプランは3件まで、Proプランは無制限。
 */
import { getSupabase } from '../db/client';

/**
 * テンプレートを保存（同名の場合は上書き）
 */
export async function saveTemplate(
  userId: string,
  name: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  try {
    const { error } = await (supabase.from('reply_templates') as any)
      .upsert({ user_id: userId, name, content }, { onConflict: 'user_id,name' });

    if (error) {
      console.error('[テンプレート] 保存エラー:', error);
      return { success: false, error: error.message };
    }

    console.log(`[テンプレート] 保存: userId=${userId} name=${name}`);
    return { success: true };
  } catch (err: any) {
    console.error('[テンプレート] 保存例外:', err);
    return { success: false, error: err.message || '不明なエラー' };
  }
}

/**
 * テンプレートを名前で取得
 */
export async function getTemplate(
  userId: string,
  name: string
): Promise<string | null> {
  const supabase = getSupabase();

  try {
    const { data } = await (supabase.from('reply_templates') as any)
      .select('content')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    return data?.content || null;
  } catch (err) {
    console.error('[テンプレート] 取得例外:', err);
    return null;
  }
}

/**
 * テンプレート一覧を取得（作成日時昇順）
 */
export async function listTemplates(
  userId: string
): Promise<Array<{ name: string; content: string }>> {
  const supabase = getSupabase();

  try {
    const { data, error } = await (supabase.from('reply_templates') as any)
      .select('name, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[テンプレート] 一覧取得エラー:', error);
      return [];
    }

    return (data || []) as Array<{ name: string; content: string }>;
  } catch (err) {
    console.error('[テンプレート] 一覧取得例外:', err);
    return [];
  }
}

/**
 * テンプレートを削除
 */
export async function deleteTemplate(
  userId: string,
  name: string
): Promise<boolean> {
  const supabase = getSupabase();

  try {
    const { error } = await (supabase.from('reply_templates') as any)
      .delete()
      .eq('user_id', userId)
      .eq('name', name);

    if (error) {
      console.error('[テンプレート] 削除エラー:', error);
      return false;
    }

    console.log(`[テンプレート] 削除: userId=${userId} name=${name}`);
    return true;
  } catch (err) {
    console.error('[テンプレート] 削除例外:', err);
    return false;
  }
}

/**
 * テンプレート件数を取得（Freeプラン制限チェック用）
 */
export async function countTemplates(userId: string): Promise<number> {
  const supabase = getSupabase();

  try {
    const { count, error } = await (supabase.from('reply_templates') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('[テンプレート] 件数取得エラー:', error);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error('[テンプレート] 件数取得例外:', err);
    return 0;
  }
}
