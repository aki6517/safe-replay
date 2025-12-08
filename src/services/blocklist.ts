/**
 * ブロックリスト管理サービス
 * 
 * 特定のメールアドレスからの通知をブロックする機能
 */
import { redis, isRedisAvailable } from '../db/redis';
import { getSupabase } from '../db/client';

const BLOCKLIST_KEY_PREFIX = 'blocklist:';

/**
 * ブロックリストにアドレスを追加
 */
export async function addToBlocklist(userId: string, emailAddress: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(emailAddress);
  
  if (!normalizedEmail) {
    return false;
  }

  // Redisに保存
  if (isRedisAvailable() && redis) {
    try {
      const key = `${BLOCKLIST_KEY_PREFIX}${userId}`;
      await redis.sadd(key, normalizedEmail);
      // 無期限で保存（ユーザーが明示的に解除するまで）
      console.log(`[ブロックリスト] 追加: ${normalizedEmail}`);
      return true;
    } catch (error) {
      console.error('[ブロックリスト] Redis追加エラー:', error);
    }
  }

  // Supabaseに保存（フォールバック）
  const supabase = getSupabase();
  if (supabase) {
    try {
      await (supabase.from('blocklist') as any).upsert({
        user_id: userId,
        email_address: normalizedEmail,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,email_address'
      });
      console.log(`[ブロックリスト] DB追加: ${normalizedEmail}`);
      return true;
    } catch (error) {
      console.error('[ブロックリスト] DB追加エラー:', error);
    }
  }

  return false;
}

/**
 * ブロックリストからアドレスを削除
 */
export async function removeFromBlocklist(userId: string, emailAddress: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(emailAddress);
  
  if (!normalizedEmail) {
    return false;
  }

  // Redisから削除
  if (isRedisAvailable() && redis) {
    try {
      const key = `${BLOCKLIST_KEY_PREFIX}${userId}`;
      await redis.srem(key, normalizedEmail);
      console.log(`[ブロックリスト] 削除: ${normalizedEmail}`);
      return true;
    } catch (error) {
      console.error('[ブロックリスト] Redis削除エラー:', error);
    }
  }

  // Supabaseから削除
  const supabase = getSupabase();
  if (supabase) {
    try {
      await (supabase.from('blocklist') as any).delete()
        .eq('user_id', userId)
        .eq('email_address', normalizedEmail);
      console.log(`[ブロックリスト] DB削除: ${normalizedEmail}`);
      return true;
    } catch (error) {
      console.error('[ブロックリスト] DB削除エラー:', error);
    }
  }

  return false;
}

/**
 * アドレスがブロックされているかチェック
 */
export async function isBlocked(userId: string, emailAddress: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(emailAddress);
  
  if (!normalizedEmail) {
    return false;
  }

  // Redisでチェック
  if (isRedisAvailable() && redis) {
    try {
      const key = `${BLOCKLIST_KEY_PREFIX}${userId}`;
      const isMember = await redis.sismember(key, normalizedEmail);
      if (isMember) {
        return true;
      }
    } catch (error) {
      console.error('[ブロックリスト] Redisチェックエラー:', error);
    }
  }

  // Supabaseでチェック
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await (supabase.from('blocklist') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('email_address', normalizedEmail)
        .single();
      
      if (data) {
        return true;
      }
    } catch (error) {
      // レコードが見つからない場合はエラーではない
    }
  }

  return false;
}

/**
 * ブロックリストを取得
 */
export async function getBlocklist(userId: string): Promise<string[]> {
  const blockedEmails: Set<string> = new Set();

  // Redisから取得
  if (isRedisAvailable() && redis) {
    try {
      const key = `${BLOCKLIST_KEY_PREFIX}${userId}`;
      const emails = await redis.smembers(key);
      emails.forEach((email: string) => blockedEmails.add(email));
    } catch (error) {
      console.error('[ブロックリスト] Redis取得エラー:', error);
    }
  }

  // Supabaseから取得
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await (supabase.from('blocklist') as any)
        .select('email_address')
        .eq('user_id', userId);
      
      if (data) {
        data.forEach((row: { email_address: string }) => blockedEmails.add(row.email_address));
      }
    } catch (error) {
      console.error('[ブロックリスト] DB取得エラー:', error);
    }
  }

  return Array.from(blockedEmails);
}

/**
 * メールアドレスを正規化
 * "名前 <email@example.com>" -> "email@example.com"
 */
function normalizeEmail(emailAddress: string): string | null {
  if (!emailAddress) {
    return null;
  }

  // <email@example.com> 形式から抽出
  const match = emailAddress.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase().trim();
  }

  // そのままのメールアドレス
  if (emailAddress.includes('@')) {
    return emailAddress.toLowerCase().trim();
  }

  return null;
}

/**
 * ドメインがブロックされているかチェック（将来拡張用）
 */
export async function isDomainBlocked(userId: string, emailAddress: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(emailAddress);
  if (!normalizedEmail) {
    return false;
  }

  const domain = normalizedEmail.split('@')[1];
  if (!domain) {
    return false;
  }

  // ドメイン単位でのブロックチェック
  return await isBlocked(userId, `*@${domain}`);
}

