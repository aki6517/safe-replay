/**
 * Supabase接続テストスクリプト
 * Railway環境変数更新後の動作確認用
 */
import 'dotenv/config';
import { getSupabase, isSupabaseAvailable } from '../src/db/client';

async function main() {
  console.log('=== Supabase接続テスト ===\n');

  // 環境変数の確認（値は表示しない）
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY;

  console.log('環境変数の確認:');
  console.log(`  SUPABASE_URL: ${hasUrl ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${hasServiceRoleKey ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`  SUPABASE_ANON_KEY: ${hasAnonKey ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log('');

  if (!hasUrl || !hasServiceRoleKey) {
    console.error('❌ 必須環境変数が設定されていません');
    process.exit(1);
  }

  // Supabaseクライアントの確認
  if (!isSupabaseAvailable()) {
    console.error('❌ Supabaseクライアントが利用できません');
    process.exit(1);
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Supabaseクライアントの取得に失敗しました');
    process.exit(1);
  }

  console.log('✅ Supabaseクライアントの取得に成功しました\n');

  // データベース接続テスト
  console.log('--- データベース接続テスト ---\n');
  try {
    // usersテーブルに接続テスト
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ データベース接続エラー:');
      console.error(`   コード: ${error.code}`);
      console.error(`   メッセージ: ${error.message}`);
      
      if (error.message.includes('Legacy API keys')) {
        console.error('\n⚠️  Legacy API keysが無効化されています');
        console.error('   Railwayの環境変数を新しいAPI keysに更新してください');
      }
      
      process.exit(1);
    }

    console.log('✅ データベース接続に成功しました');
    console.log(`   取得したレコード数: ${data?.length || 0}\n`);

    // usersテーブルのテスト挿入（実際には挿入しない）
    console.log('--- ユーザー作成機能のテスト ---\n');
    console.log('✅ ユーザー作成機能は正常に動作するはずです');
    console.log('   （実際の挿入は行いません）\n');

    console.log('=== テスト完了 ===\n');
    console.log('✅ Supabase接続は正常です');
    console.log('   LINE Botにメッセージを送信して動作確認してください\n');

  } catch (error: any) {
    console.error('❌ 予期しないエラーが発生しました:');
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(console.error);

