/**
 * Chatworkポーリングのテストスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { pollChatwork } from '../src/services/poller/chatwork';

async function main() {
  console.log('=== Chatworkポーリング テスト ===\n');

  // 環境変数チェック
  const requiredEnvVars = [
    'CHATWORK_API_TOKEN',
    'CHATWORK_MY_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_ALLOWED_USER_IDS'
  ];

  const missing: string[] = [];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ 以下の環境変数が設定されていません:');
    missing.forEach(envVar => console.error(`  - ${envVar}`));
    process.exit(1);
  }

  console.log('✅ 必要な環境変数が設定されています\n');

  // テスト用のuserId（LINE_ALLOWED_USER_IDSの最初のIDを使用）
  const userId = process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim();
  if (!userId) {
    console.error('❌ LINE_ALLOWED_USER_IDS環境変数が設定されていません');
    process.exit(1);
  }

  console.log(`✅ テストユーザーID: ${userId}\n`);

  // ポーリング実行
  console.log('--- Chatworkポーリング実行 ---');
  console.log('自分宛メッセージを取得して処理します...\n');

  try {
    const result = await pollChatwork(userId, 10); // 最大10件まで取得

    console.log('=== 処理結果 ===\n');
    console.log('サマリー:');
    console.log(`  - 処理したユーザー数: ${result.summary.users_processed}`);
    console.log(`  - チェックしたルーム数: ${result.summary.rooms_checked}`);
    console.log(`  - 取得したメッセージ数: ${result.summary.messages_fetched}`);
    console.log(`  - 新規メッセージ数: ${result.summary.messages_new}`);
    console.log(`  - スキップした自分のメッセージ数: ${result.summary.self_messages_skipped}`);
    console.log(`  - 処理時間: ${result.processingTimeMs}ms\n`);

    if (result.summary.errors.length > 0) {
      console.log('エラー:');
      result.summary.errors.forEach(error => console.error(`  - ${error}`));
      console.log('');
    }

    if (result.details.length > 0) {
      console.log('処理したメッセージ詳細:');
      result.details.forEach((detail, index) => {
        console.log(`\n  [${index + 1}] ${detail.sender || '(送信者不明)'}`);
        console.log(`      メッセージID: ${detail.message_id}`);
        console.log(`      ルームID: ${detail.room_id}`);
        console.log(`      本文: ${detail.body?.substring(0, 100)}...`);
      });
      console.log('');
    }

    if (result.summary.messages_new > 0) {
      console.log('✅ 新規メッセージが処理されました');
      console.log('   LINEアプリで通知が届いているか確認してください。\n');
    } else if (result.summary.self_messages_skipped > 0) {
      console.log('ℹ️  自分のメッセージのみでした（無限ループ防止）');
      console.log('   他のユーザーから自分宛メッセージを作成してから再度実行してください。\n');
    } else {
      console.log('ℹ️  自分宛メッセージがありませんでした');
      console.log('   テスト用Chatworkアカウントで自分宛メッセージを作成してから再度実行してください。\n');
    }

    console.log('=== テスト完了 ===');
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);

