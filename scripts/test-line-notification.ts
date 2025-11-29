/**
 * LINE通知サービスのテストスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { sendLineNotification } from '../src/services/notifier';
import { isLineClientAvailable } from '../src/services/line';

async function main() {
  console.log('=== LINE通知サービス テスト ===\n');

  // 環境変数チェック
  const lineUserId = process.env.LINE_TEST_USER_ID;
  if (!lineUserId) {
    console.error('❌ LINE_TEST_USER_ID環境変数が設定されていません');
    console.log('\n設定方法:');
    console.log('LINE_TEST_USER_ID=your_line_user_id');
    process.exit(1);
  }

  if (!isLineClientAvailable()) {
    console.error('❌ LINE Messaging API credentials not configured');
    console.log('\n必要な環境変数:');
    console.log('- LINE_CHANNEL_ACCESS_TOKEN');
    console.log('- LINE_CHANNEL_SECRET');
    process.exit(1);
  }

  console.log('✅ LINEクライアント利用可能');
  console.log(`✅ テストユーザーID: ${lineUserId}\n`);

  // テストメッセージID（ダミーUUID）
  const testMessageId = '00000000-0000-0000-0000-000000000000';

  // Type A通知のテスト
  console.log('--- Type A通知テスト ---');
  const typeASuccess = await sendLineNotification(
    lineUserId,
    testMessageId,
    'A',
    {
      subject: '【重要】プロジェクト進捗確認のお願い',
      body: 'プロジェクトの進捗状況について確認させていただきたく、ご連絡いたしました。\n\n本日までに完了予定だったタスクの状況を教えていただけますでしょうか？',
      sender: '山田太郎',
      source: 'Gmail'
    },
    'お忙しいところ恐縮ですが、プロジェクトの進捗状況について確認させていただきたく、ご連絡いたしました。\n\n本日までに完了予定だったタスクの状況を教えていただけますでしょうか？\n\nよろしくお願いいたします。'
  );
  console.log(`Type A通知: ${typeASuccess ? '✅ 成功' : '❌ 失敗'}\n`);

  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Type B通知のテスト
  console.log('--- Type B通知テスト ---');
  const typeBSuccess = await sendLineNotification(
    lineUserId,
    testMessageId,
    'B',
    {
      subject: '会議資料の共有',
      body: '先日の会議で使用した資料を共有いたします。\nご確認ください。',
      sender: '佐藤花子',
      source: 'Chatwork'
    }
  );
  console.log(`Type B通知: ${typeBSuccess ? '✅ 成功' : '❌ 失敗'}\n`);

  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Type C通知のテスト（通知されないことを確認）
  console.log('--- Type C通知テスト（通知スキップ確認） ---');
  const typeCSuccess = await sendLineNotification(
    lineUserId,
    testMessageId,
    'C',
    {
      subject: '【広告】新商品のご案内',
      body: 'この度、新商品をリリースいたしました。',
      sender: '営業部',
      source: 'Gmail'
    }
  );
  console.log(`Type C通知: ${typeCSuccess ? '✅ スキップ（正常）' : '❌ エラー'}\n`);

  console.log('=== テスト完了 ===');
}

main().catch(console.error);

