/**
 * セキュリティ・運用保全機能
 * ホワイトリストチェック、緊急通知等
 */
// import { getSupabase, isSupabaseAvailable } from '../db/client'; // 将来拡張用

/**
 * ホワイトリストから許可されたLINE User IDのリストを取得
 * 環境変数から読み込む（優先）
 * 将来拡張: DBからも取得可能にする
 */
function getAllowedUserIds(): string[] {
  // 環境変数からホワイトリストを読み込む
  const envWhitelist = process.env.LINE_ALLOWED_USER_IDS;
  if (envWhitelist) {
    return envWhitelist
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }

  // 環境変数が設定されていない場合は空配列を返す
  // （開発時は全許可、本番では空配列の場合は拒否）
  return [];
}

/**
 * DBからホワイトリストを取得（将来拡張用）
 * 現在は実装せず、将来の拡張のために関数を用意
 */
async function getAllowedUserIdsFromDB(): Promise<string[]> {
  // TODO: 将来拡張 - usersテーブルから許可されたユーザーIDを取得
  // const supabase = getSupabase();
  // if (!supabase || !isSupabaseAvailable()) {
  //   return [];
  // }
  // const { data } = await supabase
  //   .from('users')
  //   .select('line_user_id')
  //   .eq('is_active', true)
  //   .eq('is_whitelisted', true);
  // return data?.map(u => u.line_user_id).filter(Boolean) || [];
  return [];
}

/**
 * LINE User IDがホワイトリストに登録されているかチェック
 * 
 * @param userId - LINE User ID
 * @returns true: 許可されている、false: 許可されていない
 */
export async function isUserAllowed(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return false;
  }

  // 環境変数からホワイトリストを取得
  const envWhitelist = getAllowedUserIds();

  // 環境変数にホワイトリストが設定されている場合
  if (envWhitelist.length > 0) {
    return envWhitelist.includes(userId);
  }

  // 環境変数が設定されていない場合、DBから取得を試みる（将来拡張）
  const dbWhitelist = await getAllowedUserIdsFromDB();
  if (dbWhitelist.length > 0) {
    return dbWhitelist.includes(userId);
  }

  // どちらも設定されていない場合
  // 開発環境では警告を出して許可（開発時のみ）
  // 本番環境では拒否すべきだが、現時点では開発を優先
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[セキュリティ警告] LINEホワイトリストが設定されていません。開発環境のため、ユーザー ${userId} を許可します。`
    );
    return true;
  }

  // 本番環境では拒否
  console.warn(
    `[セキュリティ警告] LINEホワイトリストが設定されていません。ユーザー ${userId} を拒否します。`
  );
  return false;
}

/**
 * 同期版のホワイトリストチェック（環境変数のみ）
 * パフォーマンスが重要な場合に使用
 * 
 * @param userId - LINE User ID
 * @returns true: 許可されている、false: 許可されていない
 */
export function isUserAllowedSync(userId: string | null | undefined): boolean {
  if (!userId) {
    return false;
  }

  const envWhitelist = getAllowedUserIds();

  if (envWhitelist.length > 0) {
    return envWhitelist.includes(userId);
  }

  // 環境変数が設定されていない場合
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[セキュリティ警告] LINEホワイトリストが設定されていません。開発環境のため、ユーザー ${userId} を許可します。`
    );
    return true;
  }

  console.warn(
    `[セキュリティ警告] LINEホワイトリストが設定されていません。ユーザー ${userId} を拒否します。`
  );
  return false;
}

