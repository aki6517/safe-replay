/**
 * LINE転送メッセージ処理のテストスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { processForwardedMessage } from '../src/services/message-processor';

async function main() {
  console.log('=== LINE転送メッセージ処理 テスト ===\n');

  // 環境変数チェック
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_ALLOWED_USER_IDS',
    'OPENAI_API_KEY'
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

  // テスト用のLINE User ID
  const lineUserId = process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim();
  if (!lineUserId) {
    console.error('❌ LINE_ALLOWED_USER_IDS環境変数が設定されていません');
    process.exit(1);
  }

  console.log(`✅ テストユーザーID: ${lineUserId}\n`);

  // テスト用の転送メッセージ（Type A想定：重要なメッセージ）
  const testMessageA = `件名: 緊急：プロジェクトの進捗確認について

お世話になっております。

来週のミーティングに向けて、プロジェクトの進捗状況について確認させていただきたく、ご連絡いたしました。

以下の点について、ご確認いただけますでしょうか？

1. 現在の進捗状況
2. 今後のスケジュール
3. 懸念事項があれば教えてください

よろしくお願いいたします。`;

  // テスト用の転送メッセージ（Type B想定：共有・CCメッセージ）
  const testMessageB = `件名: 【共有】週次レポート

皆さん

今週の週次レポートを共有いたします。

ご確認ください。`;

  // テスト用の転送メッセージ（Type C想定：ノイズ）
  const testMessageC = `【限定セール】今だけ50%OFF！

期間限定セール実施中です。
この機会にぜひご利用ください。`;

  console.log('--- テスト1: Type A想定メッセージ（重要なメッセージ） ---\n');
  try {
    await processForwardedMessage(lineUserId, testMessageA);
    console.log('\n✅ Type A想定メッセージの処理が完了しました\n');
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // 少し待機（DB処理が完了するまで）
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- テスト2: Type B想定メッセージ（共有・CCメッセージ） ---\n');
  try {
    await processForwardedMessage(lineUserId, testMessageB);
    console.log('\n✅ Type B想定メッセージの処理が完了しました\n');
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // 少し待機（DB処理が完了するまで）
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- テスト3: Type C想定メッセージ（ノイズ） ---\n');
  try {
    await processForwardedMessage(lineUserId, testMessageC);
    console.log('\n✅ Type C想定メッセージの処理が完了しました（通知は送信されません）\n');
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  console.log('=== テスト完了 ===\n');
  console.log('📱 LINEアプリで通知が届いているか確認してください:');
  console.log('   - Type A: Flex Messageが表示される（ドラフト付き）');
  console.log('   - Type B: Flex Messageが表示される（静音通知）');
  console.log('   - Type C: 通知は送信されません\n');
  console.log('💾 DBにメッセージが保存されているか確認してください:');
  console.log('   - Supabaseのmessagesテーブルを確認');
  console.log('   - source_type = \'line_forward\' のレコードを確認\n');
}

main().catch(console.error);

