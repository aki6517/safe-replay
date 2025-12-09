/**
 * 編集モード管理サービス
 * 
 * ユーザーがLINEで返信文を編集中かどうかを管理
 */
import { isRedisAvailable, getRedis } from '../db/redis';

// 編集モードのキープレフィックス
const EDIT_MODE_PREFIX = 'edit_mode:';

// 編集モードの有効期限（5分）
const EDIT_MODE_TTL = 300;

interface EditModeData {
  messageId: string;
  currentDraft: string;
  startedAt: string;
}

/**
 * 編集モードを開始
 */
export async function startEditMode(
  lineUserId: string,
  messageId: string,
  currentDraft: string
): Promise<boolean> {
  if (!isRedisAvailable()) {
    console.warn('[編集モード] Redisが利用できません');
    return false;
  }

  try {
    const redis = getRedis();
    const key = `${EDIT_MODE_PREFIX}${lineUserId}`;
    const data: EditModeData = {
      messageId,
      currentDraft,
      startedAt: new Date().toISOString()
    };

    await redis.setex(key, EDIT_MODE_TTL, JSON.stringify(data));
    console.log('[編集モード開始]', { lineUserId, messageId });
    return true;
  } catch (error: any) {
    console.error('[編集モード開始エラー]', error.message);
    return false;
  }
}

/**
 * 編集モードを取得
 */
export async function getEditMode(lineUserId: string): Promise<EditModeData | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedis();
    const key = `${EDIT_MODE_PREFIX}${lineUserId}`;
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
    return null;
  }
}

/**
 * 編集モードを終了
 */
export async function endEditMode(lineUserId: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedis();
    const key = `${EDIT_MODE_PREFIX}${lineUserId}`;
    await redis.del(key);
    console.log('[編集モード終了]', { lineUserId });
    return true;
  } catch (error: any) {
    console.error('[編集モード終了エラー]', error.message);
    return false;
  }
}

/**
 * 編集モード中かどうかチェック
 */
export async function isInEditMode(lineUserId: string): Promise<boolean> {
  const editMode = await getEditMode(lineUserId);
  return editMode !== null;
}

