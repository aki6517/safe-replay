/**
 * 緊急通知機能のテストスクリプト
 * 
 * 使用方法:
 *   npm run test-emergency-notification
 * 
 * 環境変数:
 *   LINE_ALLOWED_USER_IDS - 通知を送信するLINE User ID（カンマ区切り）
 */
import dotenv from 'dotenv';
dotenv.config(); // 環境変数を読み込む

import {
  sendEmergencyNotification,
  notifyApiTokenExpired,
  notifySystemDown,
  notifyDatabaseError,
  sendWarningNotification
} from '../src/utils/emergency-notification';

async function runTest() {
  console.log('=== 緊急通知機能のテスト ===\n');

  // 環境変数からLINE User IDを取得
  const lineUserId = process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim();
  if (!lineUserId) {
    console.error('❌ 環境変数 LINE_ALLOWED_USER_IDS が設定されていません。');
    process.exit(1);
  }

  console.log(`テスト対象LINE User ID: ${lineUserId}\n`);

  // テスト1: 汎用緊急通知（critical）
  console.log('--- テスト1: 汎用緊急通知（critical） ---\n');
  try {
    const success = await sendEmergencyNotification(
      'システムテスト',
      'これは緊急通知機能のテストメッセージです。',
      {
        severity: 'critical',
        details: 'テスト詳細情報:\n- テスト項目1\n- テスト項目2',
        userIds: [lineUserId]
      }
    );
    if (success) {
      console.log('✅ 緊急通知（critical）の送信が完了しました\n');
    } else {
      console.log('❌ 緊急通知（critical）の送信に失敗しました\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // 少し待機（通知が処理される時間を確保）
  await new Promise(resolve => setTimeout(resolve, 2000));

  // テスト2: 警告レベルの通知（warning）
  console.log('--- テスト2: 警告レベルの通知（warning） ---\n');
  try {
    const success = await sendWarningNotification(
      'システム警告',
      'これは警告レベルの通知のテストメッセージです。',
      '警告の詳細情報がここに表示されます。'
    );
    if (success) {
      console.log('✅ 警告通知の送信が完了しました\n');
    } else {
      console.log('❌ 警告通知の送信に失敗しました\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 2000));

  // テスト3: APIトークン失効通知
  console.log('--- テスト3: APIトークン失効通知（Gmail） ---\n');
  try {
    const success = await notifyApiTokenExpired(
      'Gmail',
      '401 Unauthorized - Invalid or expired token'
    );
    if (success) {
      console.log('✅ APIトークン失効通知の送信が完了しました\n');
    } else {
      console.log('❌ APIトークン失効通知の送信に失敗しました\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 2000));

  // テスト4: データベースエラー通知
  console.log('--- テスト4: データベースエラー通知 ---\n');
  try {
    const success = await notifyDatabaseError(
      'Connection timeout - Unable to connect to database'
    );
    if (success) {
      console.log('✅ データベースエラー通知の送信が完了しました\n');
    } else {
      console.log('❌ データベースエラー通知の送信に失敗しました\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 2000));

  // テスト5: システム停止通知
  console.log('--- テスト5: システム停止通知 ---\n');
  try {
    const success = await notifySystemDown(
      'メモリ不足によるシステムクラッシュ',
      'システムがメモリ不足によりクラッシュしました。\n再起動が必要です。'
    );
    if (success) {
      console.log('✅ システム停止通知の送信が完了しました\n');
    } else {
      console.log('❌ システム停止通知の送信に失敗しました\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  console.log('=== テスト完了 ===\n');
  console.log('📱 LINEアプリで以下の通知が届いているか確認してください:');
  console.log('   1. 【緊急】システムテスト（赤色）');
  console.log('   2. 【警告】システム警告（オレンジ色）');
  console.log('   3. 【緊急】Gmail APIトークン失効（赤色）');
  console.log('   4. 【緊急】データベース接続エラー（赤色）');
  console.log('   5. 【緊急】システム停止検知（赤色）');
  console.log('\n💡 注意: 同じエラーが1時間以内に複数回発生した場合、');
  console.log('   重複通知防止機能により、最初の1回のみ通知が送信されます。\n');
}

runTest().catch((error) => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});

