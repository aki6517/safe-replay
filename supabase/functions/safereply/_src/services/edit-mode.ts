/**
 * 編集モード管理サービス
 * 
 * ユーザーがLINEで返信文を編集中かどうかを管理
 */
import { isRedisAvailable, getRedis, markRedisUnavailable } from '../db/redis.ts';
import { getSupabase, isSupabaseAvailable } from '../db/client.ts';

// 編集モードのキープレフィックス
const EDIT_MODE_PREFIX = 'edit_mode:';
const EDIT_MODE_TABLE = 'line_edit_modes';

// 編集モードの有効期限（5分）
const EDIT_MODE_TTL = 300;
const EDIT_MODE_TTL_MS = EDIT_MODE_TTL * 1000;

// Redis障害時のフォールバック（単一プロセス内のみ有効）
const inMemoryEditModes = new Map<string, { data: EditModeData; expiresAt: number }>();

interface EditModeData {
  messageId: string;
  currentDraft: string;
  startedAt: string;
}

async function saveEditModeToSupabase(
  lineUserId: string,
  data: EditModeData,
  expiresAtIso: string
): Promise<boolean> {
  if (!isSupabaseAvailable()) {
    return false;
  }

  try {
    const supabase = getSupabase();
    const { error } = await (supabase as any)
      .from(EDIT_MODE_TABLE)
      .upsert(
        {
          line_user_id: lineUserId,
          message_id: data.messageId,
          current_draft: data.currentDraft,
          started_at: data.startedAt,
          expires_at: expiresAtIso
        },
        { onConflict: 'line_user_id' }
      );

    if (error) {
      console.error('[編集モード保存エラー: Supabase]', error.message);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error('[編集モード保存エラー: Supabase]', error.message);
    return false;
  }
}

async function getEditModeFromSupabase(lineUserId: string): Promise<EditModeData | null> {
  if (!isSupabaseAvailable()) {
    return null;
  }

  const nowIso = new Date().toISOString();

  try {
    const supabase = getSupabase();
    const { data, error } = await (supabase as any)
      .from(EDIT_MODE_TABLE)
      .select('message_id, current_draft, started_at, expires_at')
      .eq('line_user_id', lineUserId)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (error) {
      console.error('[編集モード取得エラー: Supabase]', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      messageId: String(data.message_id),
      currentDraft: String(data.current_draft),
      startedAt: String(data.started_at)
    };
  } catch (error: any) {
    console.error('[編集モード取得エラー: Supabase]', error.message);
    return null;
  }
}

async function deleteEditModeFromSupabase(lineUserId: string): Promise<boolean> {
  if (!isSupabaseAvailable()) {
    return false;
  }

  try {
    const supabase = getSupabase();
    const { error } = await (supabase as any)
      .from(EDIT_MODE_TABLE)
      .delete()
      .eq('line_user_id', lineUserId);
    if (error) {
      console.error('[編集モード終了エラー: Supabase]', error.message);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error('[編集モード終了エラー: Supabase]', error.message);
    return false;
  }
}

/**
 * 編集モードを開始
 */
export async function startEditMode(
  lineUserId: string,
  messageId: string,
  currentDraft: string
): Promise<boolean> {
  const key = `${EDIT_MODE_PREFIX}${lineUserId}`;
  const startedAt = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + EDIT_MODE_TTL_MS).toISOString();
  const data: EditModeData = {
    messageId,
    currentDraft,
    startedAt
  };

  if (isRedisAvailable()) {
    try {
      const redis = getRedis();
      await redis.setex(key, EDIT_MODE_TTL, JSON.stringify(data));
      // Redis利用時もフォールバックを保持しておく
      inMemoryEditModes.set(key, { data, expiresAt: Date.now() + EDIT_MODE_TTL_MS });
      console.log('[編集モード開始]', { lineUserId, messageId });
      return true;
    } catch (error: any) {
      console.error('[編集モード開始エラー]', error.message);
      markRedisUnavailable(error);
    }
  }

  // Redisが使えない場合はSupabaseへ保存
  const savedToSupabase = await saveEditModeToSupabase(lineUserId, data, expiresAtIso);
  if (savedToSupabase) {
    inMemoryEditModes.set(key, { data, expiresAt: Date.now() + EDIT_MODE_TTL_MS });
    console.log('[編集モード開始: Supabase]', { lineUserId, messageId });
    return true;
  }

  // Redisが使えない場合はメモリにフォールバック
  inMemoryEditModes.set(key, { data, expiresAt: Date.now() + EDIT_MODE_TTL_MS });
  console.warn('[編集モード] Redis未使用のためメモリフォールバックで開始しました', { lineUserId, messageId });
  return true;
}

/**
 * 編集モードを取得
 */
export async function getEditMode(lineUserId: string): Promise<EditModeData | null> {
  const key = `${EDIT_MODE_PREFIX}${lineUserId}`;

  if (isRedisAvailable()) {
    try {
      const redis = getRedis();
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      // データが文字列の場合はパース
      if (typeof data === 'string') {
        return JSON.parse(data) as EditModeData;
      }

      // 既にオブジェクトの場合はそのまま返す
      return data as EditModeData;
    } catch (error: any) {
      console.error('[編集モード取得エラー]', error.message);
      markRedisUnavailable(error);
    }
  }

  // Redisが使えない場合はSupabaseを参照
  const supabaseEditMode = await getEditModeFromSupabase(lineUserId);
  if (supabaseEditMode) {
    inMemoryEditModes.set(key, { data: supabaseEditMode, expiresAt: Date.now() + EDIT_MODE_TTL_MS });
    return supabaseEditMode;
  }

  // Redisが使えない場合はメモリフォールバック
  const fallback = inMemoryEditModes.get(key);
  if (!fallback) {
    return null;
  }
  if (Date.now() > fallback.expiresAt) {
    inMemoryEditModes.delete(key);
    return null;
  }
  return fallback.data;
}

/**
 * 編集モードを終了
 */
export async function endEditMode(lineUserId: string): Promise<boolean> {
  const key = `${EDIT_MODE_PREFIX}${lineUserId}`;
  let redisDeleted = false;

  if (isRedisAvailable()) {
    try {
      const redis = getRedis();
      await redis.del(key);
      redisDeleted = true;
    } catch (error: any) {
      console.error('[編集モード終了エラー]', error.message);
      markRedisUnavailable(error);
    }
  }

  const supabaseDeleted = await deleteEditModeFromSupabase(lineUserId);
  const memoryDeleted = inMemoryEditModes.delete(key);
  if (redisDeleted || supabaseDeleted || memoryDeleted) {
    console.log('[編集モード終了]', { lineUserId });
  }
  // 削除対象がなかった場合も、終了操作自体は成功扱いにする
  return true;
}

/**
 * 編集モード中かどうかチェック
 */
export async function isInEditMode(lineUserId: string): Promise<boolean> {
  const editMode = await getEditMode(lineUserId);
  return editMode !== null;
}
