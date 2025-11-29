/**
 * Supabaseキーの動作確認スクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { getSupabase, isSupabaseAvailable } from '../src/db/client';

async function main() {
  console.log('=== Supabaseキー動作確認 ===\n');

  // 環境変数の確認
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  console.log('環境変数確認:');
  console.log(`- SUPABASE_URL: ${supabaseUrl ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? (serviceRoleKey.startsWith('sb_secret_') ? '✅ 新しいSecret Key' : '⚠️  Legacy Key') : '❌ 未設定'}`);
  console.log(`- SUPABASE_ANON_KEY: ${anonKey ? (anonKey.startsWith('sb_publishable_') ? '✅ 新しいPublishable Key' : '⚠️  Legacy Key') : '❌ 未設定'}`);
  console.log('');

  // Supabaseクライアントの確認
  if (!isSupabaseAvailable()) {
    console.error('❌ Supabaseクライアントが利用できません');
    process.exit(1);
  }

  console.log('✅ Supabaseクライアント利用可能');
  console.log('');

  // 簡単なクエリで動作確認
  try {
    const supabase = getSupabase();
    console.log('データベース接続テスト...');
    
    // messagesテーブルから1件取得（存在確認）
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ データベース接続エラー:', error.message);
      process.exit(1);
    }

    console.log('✅ データベース接続成功');
    console.log(`✅ メッセージテーブルへのアクセス成功（${data?.length || 0}件）`);
    console.log('');
    console.log('=== 確認完了 ===');
    console.log('✅ 新しいAPI Keysが正常に動作しています');
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

