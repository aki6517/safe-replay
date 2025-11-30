/**
 * LINEアクションハンドラーのテストスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { handleLineAction } from '../src/services/action-handler';
import { getSupabase } from '../src/db/client';

async function main() {
  console.log('=== LINEアクションハンドラー テスト ===\n');

  // 環境変数チェック
  const requiredEnvVars = [
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

  // テスト用のLINE User ID
  const lineUserId = process.env.LINE_ALLOWED_USER_IDS?.split(',')[0]?.trim();
  if (!lineUserId) {
    console.error('❌ LINE_ALLOWED_USER_IDS環境変数が設定されていません');
    process.exit(1);
  }

  console.log(`✅ テストユーザーID: ${lineUserId}\n`);

  // テスト用のメッセージを取得（最新のline_forwardメッセージ）
  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Supabaseクライアントが利用できません');
    process.exit(1);
  }

  console.log('--- テスト用メッセージを取得 ---\n');
  const { data: messages, error: fetchError } = await supabase
    .from('messages')
    .select('*')
    .eq('source_type', 'line_forward')
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError || !messages || messages.length === 0) {
    console.error('❌ テスト用メッセージが見つかりません');
    console.error('   先にLINE転送メッセージ処理のテストを実行してください。');
    console.error('   npm run test-line-forward-message\n');
    process.exit(1);
  }

  const testMessage = messages[0];
  console.log('✅ テスト用メッセージを取得しました');
  console.log(`   メッセージID: ${testMessage.id}`);
  console.log(`   ソースタイプ: ${testMessage.source_type}`);
  console.log(`   ステータス: ${testMessage.status}\n`);

  // テスト1: 却下アクション
  console.log('--- テスト1: 却下アクション（dismiss） ---\n');
  try {
    const dismissActionData = `action=dismiss&message_id=${testMessage.id}`;
    await handleLineAction(lineUserId, dismissActionData);
    console.log('\n✅ 却下アクションの処理が完了しました\n');
    
    // ステータスを確認
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { data: updatedMessage } = await supabase
      .from('messages')
      .select('status')
      .eq('id', testMessage.id)
      .single();
    
    if (updatedMessage?.status === 'dismissed') {
      console.log('✅ メッセージステータスが「dismissed」に更新されました\n');
    } else {
      console.log('⚠️  メッセージステータスの更新を確認できませんでした\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // テスト2: 編集アクション
  console.log('--- テスト2: 編集アクション（edit） ---\n');
  try {
    const editActionData = `action=edit&message_id=${testMessage.id}`;
    await handleLineAction(lineUserId, editActionData);
    console.log('\n✅ 編集アクションの処理が完了しました\n');
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // テスト3: 既読アクション
  console.log('--- テスト3: 既読アクション（read） ---\n');
  try {
    const readActionData = `action=read&message_id=${testMessage.id}`;
    await handleLineAction(lineUserId, readActionData);
    console.log('\n✅ 既読アクションの処理が完了しました\n');
    
    // ステータスを確認
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { data: readMessage } = await supabase
      .from('messages')
      .select('status')
      .eq('id', testMessage.id)
      .single();
    
    if (readMessage?.status === 'read') {
      console.log('✅ メッセージステータスが「read」に更新されました\n');
    } else {
      console.log('⚠️  メッセージステータスの更新を確認できませんでした\n');
    }
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }

  // テスト4: 確認メール送信アクション（Gmailの場合は実際に送信される）
  console.log('--- テスト4: 確認メール送信アクション（acknowledge） ---\n');
  console.log('⚠️  注意: このテストは実際にメール/メッセージを送信します\n');
  
  const sourceType = testMessage.source_type;
  if (sourceType === 'gmail') {
    console.log('Gmail確認メール送信テスト:');
    console.log('  - Gmail APIの認証情報が必要です');
    console.log('  - 実際に確認メールが送信されます\n');
  } else {
    console.log(`ソースタイプ「${sourceType}」は確認メール送信テストをスキップします`);
    console.log('  （確認メールはGmailメッセージのみ送信可能）\n');
  }

  const shouldTestAck = process.env.TEST_ACK_ACTION === 'true';
  if (shouldTestAck && sourceType === 'gmail') {
    try {
      const ackActionData = `action=acknowledge&message_id=${testMessage.id}`;
      await handleLineAction(lineUserId, ackActionData);
      console.log('\n✅ 確認メール送信アクションの処理が完了しました\n');
      
      // ステータスを確認
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: ackMessage } = await supabase
        .from('messages')
        .select('status')
        .eq('id', testMessage.id)
        .single();
      
      if (ackMessage?.status === 'read') {
        console.log('✅ メッセージステータスが「read」に更新されました\n');
      } else {
        console.log('⚠️  メッセージステータスの更新を確認できませんでした\n');
      }
    } catch (error: any) {
      console.error('❌ エラーが発生しました:', error.message);
      console.error(error);
    }
  } else {
    console.log('ℹ️  確認メール送信テストをスキップしました');
    console.log('   確認メール送信テストを実行する場合は、TEST_ACK_ACTION=true を設定してください\n');
  }

  console.log('=== テスト完了 ===\n');
  console.log('📱 LINEアプリで通知が届いているか確認してください:');
  console.log('   - 却下アクション: 「✅ 返信を却下しました。」');
  console.log('   - 編集アクション: 「編集機能は現在開発中です...」');
  console.log('   - 既読アクション: 「✅ 既読にしました。」');
  if (shouldTestAck && sourceType === 'gmail') {
    console.log('   - 確認メール送信アクション: 「✅ 確認メールを送信しました。」');
  }
  console.log('\n💾 DBにメッセージステータスが更新されているか確認してください:');
  console.log('   - Supabaseのmessagesテーブルを確認');
  console.log(`   - message_id = '${testMessage.id}' のレコードを確認\n`);
}

main().catch(console.error);

