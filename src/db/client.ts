/**
 * Supabase クライアント設定
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/**
 * Supabase環境変数の検証
 * @throws {Error} 必須環境変数が設定されていない場合
 */
export function validateSupabaseEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Supabase環境変数が不足しています: ${missing.join(', ')}`
    );
  }
}

// 開発環境では環境変数が設定されていない場合でもエラーを投げない
let supabase: SupabaseClient<Database> | null = null;
let supabaseAnon: SupabaseClient<Database> | null = null;

/**
 * Supabaseクライアントを初期化（遅延初期化）
 */
function initializeSupabase(): void {
  const currentUrl = process.env.SUPABASE_URL;
  const currentServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const currentAnonKey = process.env.SUPABASE_ANON_KEY;

  if (currentUrl && currentServiceRoleKey && !supabase) {
    // Service Role Keyを使用（RLSをバイパス）
    supabase = createClient<Database>(
      currentUrl,
      currentServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  } else if (!supabase && (!currentUrl || !currentServiceRoleKey)) {
    console.warn('⚠️  Supabase環境変数が設定されていません');
  }

  if (currentUrl && currentAnonKey && !supabaseAnon) {
    // Anon Keyを使用（RLS有効）
    supabaseAnon = createClient<Database>(
      currentUrl,
      currentAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
}

// モジュール読み込み時に一度初期化を試みる
initializeSupabase();

export { supabase, supabaseAnon };

// クライアントが利用可能かチェックする関数
export function isSupabaseAvailable(): boolean {
  // 再初期化を試みる（環境変数が後から設定された場合に対応）
  if (supabase === null) {
    initializeSupabase();
  }
  return supabase !== null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getSupabase(): SupabaseClient<Database> {
  // 再初期化を試みる（環境変数が後から設定された場合に対応）
  if (supabase === null) {
    initializeSupabase();
  }
  if (!supabase) {
    throw new Error('Supabase環境変数が設定されていません');
  }
  return supabase;
}

