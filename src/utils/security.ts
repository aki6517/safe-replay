/**
 * セキュリティ・運用保全機能
 * ユーザーアクセス制御（DB + 環境変数フォールバック）
 */
import { getSupabase, isSupabaseAvailable } from '../db/client';

/**
 * 環境変数からホワイトリストを取得（フォールバック用）
 */
export function getAllowedUserIds(): string[] {
  const envWhitelist = process.env.LINE_ALLOWED_USER_IDS;
  if (envWhitelist) {
    return envWhitelist
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }
  return [];
}

/**
 * DBからユーザーステータスを確認
 * @returns 'active' | 'pending' | 'suspended' | 'deleted' | null（未登録）
 */
async function getUserStatusFromDB(lineUserId: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return null;
    }

    const { data, error } = await (supabase.from('users') as any)
      .select('status')
      .eq('line_user_id', lineUserId)
      .single();

    if (error || !data) {
      return null; // ユーザー未登録
    }

    return data.status;
  } catch {
    return null;
  }
}

/**
 * LINE User IDのアクセス可否を判定（非同期・DB参照）
 *
 * 優先順序:
 * 1. DBに登録済み → statusで判定（active=許可、それ以外=拒否）
 * 2. 環境変数ホワイトリストに含まれる → 許可
 * 3. どちらにもない → 拒否（本番）/ 許可（開発）
 */
export async function isUserAllowed(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  // 1. DB確認
  const status = await getUserStatusFromDB(userId);
  if (status !== null) {
    return status === 'active';
  }

  // 2. 環境変数フォールバック
  const envWhitelist = getAllowedUserIds();
  if (envWhitelist.length > 0) {
    return envWhitelist.includes(userId);
  }

  // 3. 未設定時
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[セキュリティ警告] ユーザー ${userId} はDB未登録・ホワイトリスト未設定。開発環境のため許可。`
    );
    return true;
  }

  return false;
}

/**
 * 同期版のアクセスチェック（環境変数のみ・高速）
 * Webhook等のパフォーマンスが重要な場所で使用
 *
 * 注: SaaS化後はisUserAllowed（非同期）の使用を推奨
 */
export function isUserAllowedSync(userId: string | null | undefined): boolean {
  if (!userId) return false;

  const envWhitelist = getAllowedUserIds();

  if (envWhitelist.length > 0) {
    return envWhitelist.includes(userId);
  }

  // 環境変数が未設定の場合は全員許可
  // （SaaS化後はDB登録ユーザーのみがBotを使うため、
  //   followイベントで自動登録→非同期チェックに移行）
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // 本番でホワイトリスト未設定 → 全員許可（SaaS前提）
  // セルフサービス登録により、未登録ユーザーもfollow→pending作成→設定後activeの流れ
  return true;
}
