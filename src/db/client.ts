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

if (supabaseUrl && supabaseServiceRoleKey) {
  // Service Role Keyを使用（RLSをバイパス）
  supabase = createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
} else {
  console.warn('⚠️  Supabase環境変数が設定されていません');
}

if (supabaseUrl && supabaseAnonKey) {
  // Anon Keyを使用（RLS有効）
  supabaseAnon = createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export { supabase, supabaseAnon };

// クライアントが利用可能かチェックする関数
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase環境変数が設定されていません');
  }
  return supabase;
}

