/**
 * アカウント削除サービス
 */
import { getSupabase } from '../db/client';
import { redis, isRedisAvailable } from '../db/redis';
import { sendTextMessage } from './line';

export async function deleteAccount(lineUserId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  // ユーザーIDを取得
  const { data: user } = await (supabase.from('users') as any)
    .select('id')
    .eq('line_user_id', lineUserId)
    .single();

  if (!user) return { success: false, error: 'User not found' };

  const userId = user.id;

  // Redisのキャッシュを削除
  if (isRedisAvailable() && redis) {
    try {
      await redis.del(`gmail:processed:${userId}`);
      await redis.del(`chatwork:processed:${userId}`);
    } catch (e) {
      console.warn('[Account] Redis cleanup failed:', e);
    }
  }

  // users行を削除（CASCADE で子テーブルも全削除）
  const { error } = await (supabase.from('users') as any)
    .delete()
    .eq('id', userId);

  if (error) return { success: false, error: error.message };

  // LINE通知
  try {
    await sendTextMessage(lineUserId, 'アカウントを削除しました。ご利用ありがとうございました。');
  } catch (e) {
    // 削除後のLINE通知失敗は無視
  }

  return { success: true };
}
