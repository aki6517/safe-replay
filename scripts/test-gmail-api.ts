/**
 * Gmail API連携の動作確認スクリプト
 * 
 * 使用方法:
 * npm run test-gmail-api
 */
import * as dotenv from 'dotenv';
import {
  isGmailClientAvailable,
  getUnreadMessages,
  extractMessageBody,
  extractMessageHeaders
} from '../src/services/gmail';

dotenv.config();

async function testGmailAPI() {
  console.log('🧪 Gmail API動作確認テスト\n');

  // 1. 環境変数の確認
  console.log('1️⃣ 環境変数の確認...');
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ エラー: 環境変数が設定されていません');
    console.error('   .envファイルに以下を設定してください:');
    console.error('   - GMAIL_CLIENT_ID');
    console.error('   - GMAIL_CLIENT_SECRET');
    console.error('   - GMAIL_REFRESH_TOKEN\n');
    process.exit(1);
  }

  console.log('   ✅ GMAIL_CLIENT_ID: ' + clientId.substring(0, 20) + '...');
  console.log('   ✅ GMAIL_CLIENT_SECRET: ' + clientSecret.substring(0, 10) + '...');
  console.log('   ✅ GMAIL_REFRESH_TOKEN: ' + refreshToken.substring(0, 20) + '...\n');

  // 2. Gmail APIクライアントの確認
  console.log('2️⃣ Gmail APIクライアントの確認...');
  if (!isGmailClientAvailable()) {
    console.error('❌ エラー: Gmail APIクライアントが利用できません');
    process.exit(1);
  }
  console.log('   ✅ Gmail APIクライアントが利用可能です\n');

  // 3. 過去3日分のメールの取得（迷惑メール・ゴミ箱を除外）
  console.log('3️⃣ 過去3日分のメールの取得（迷惑メール・ゴミ箱を除外）...');
  try {
    const messages = await getUnreadMessages(5, 3); // 最大5件取得、過去3日分
    console.log(`   ✅ ${messages.length}件のメールを取得しました\n`);

    if (messages.length === 0) {
      console.log('   ℹ️  過去3日分のメールがありません');
      console.log('   💡 テスト用にGmailアカウントにメールを作成してください\n');
    } else {
      // 4. メッセージの詳細表示
      console.log('4️⃣ メッセージの詳細表示...\n');
      for (let i = 0; i < Math.min(messages.length, 3); i++) {
        const message = messages[i];
        const headers = extractMessageHeaders(message);
        const body = extractMessageBody(message);

        console.log(`📧 メッセージ #${i + 1}:`);
        console.log(`   ID: ${message.id}`);
        console.log(`   From: ${headers.from || 'N/A'}`);
        console.log(`   Subject: ${headers.subject || 'N/A'}`);
        console.log(`   Date: ${headers.date || 'N/A'}`);
        console.log(`   Snippet: ${message.snippet.substring(0, 100)}...`);
        console.log(`   Body length: ${body.length} characters\n`);
      }
    }

    console.log('✅ すべてのテストが成功しました！\n');
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error('\nトラブルシューティング:');
    console.error('1. リフレッシュトークンが有効か確認してください');
    console.error('2. Gmail APIが有効になっているか確認してください');
    console.error('3. OAuth同意画面でスコープが正しく設定されているか確認してください');
    process.exit(1);
  }
}

testGmailAPI();


