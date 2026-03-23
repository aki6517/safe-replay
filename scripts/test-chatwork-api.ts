/**
 * Chatwork API連携の動作確認スクリプト
 * 
 * 使用方法:
 * npm run test-chatwork-api
 */
import * as dotenv from 'dotenv';
import {
  isChatworkClientAvailable,
  getMyId,
  getRooms,
  getMessagesToMe,
  extractMessageText
} from '../src/services/chatwork';

dotenv.config();

async function testChatworkAPI() {
  console.log('🧪 Chatwork API動作確認テスト\n');

  // 1. 環境変数の確認
  console.log('1️⃣ 環境変数の確認...');
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const myIdStr = process.env.CHATWORK_MY_ID;

  if (!apiToken) {
    console.error('❌ エラー: 環境変数が設定されていません');
    console.error('   .envファイルに以下を設定してください:');
    console.error('   - CHATWORK_API_TOKEN');
    console.error('   - CHATWORK_MY_ID (オプション: 自動取得されます)\n');
    process.exit(1);
  }

  console.log('   ✅ CHATWORK_API_TOKEN: ' + apiToken.substring(0, 10) + '...');
  if (myIdStr) {
    console.log('   ✅ CHATWORK_MY_ID: ' + myIdStr);
  } else {
    console.log('   ℹ️  CHATWORK_MY_ID: 未設定（自動取得されます）');
  }
  console.log('');

  // 2. Chatwork APIクライアントの確認
  console.log('2️⃣ Chatwork APIクライアントの確認...');
  if (!isChatworkClientAvailable()) {
    console.error('❌ エラー: Chatwork APIクライアントが利用できません');
    process.exit(1);
  }
  console.log('   ✅ Chatwork APIクライアントが利用可能です\n');

  try {
    // 3. 自分のIDを取得
    console.log('3️⃣ 自分のChatwork IDを取得...');
    const myId = await getMyId();
    console.log(`   ✅ 自分のID: ${myId}\n`);

    // 4. ルーム一覧の取得
    console.log('4️⃣ ルーム一覧の取得...');
    const rooms = await getRooms();
    console.log(`   ✅ ${rooms.length}件のルームを取得しました\n`);

    if (rooms.length === 0) {
      console.log('   ℹ️  参加中のルームがありません');
      console.log('   💡 Chatworkでルームに参加してください\n');
    } else {
      // 最初の3つのルームを表示
      for (let i = 0; i < Math.min(rooms.length, 3); i++) {
        const room = rooms[i];
        console.log(`   📁 ルーム #${i + 1}:`);
        console.log(`      ID: ${room.room_id}`);
        console.log(`      名前: ${room.name}`);
        console.log(`      タイプ: ${room.type}`);
        console.log(`      未読数: ${room.unread_num}`);
        console.log(`      メンション数: ${room.mention_num}\n`);
      }
    }

    // 5. 自分宛メッセージの取得
    console.log('5️⃣ 自分宛メッセージの取得...');
    const messages = await getMessagesToMe(10); // 最大10件取得
    console.log(`   ✅ ${messages.length}件の自分宛メッセージを取得しました\n`);

    if (messages.length === 0) {
      console.log('   ℹ️  自分宛メッセージがありません');
      console.log('   💡 テスト用にChatworkで自分宛メッセージ（[To:自分のID] または directルームの受信）を作成してください\n');
    } else {
      // 6. メッセージの詳細表示
      console.log('6️⃣ メッセージの詳細表示...\n');
      for (let i = 0; i < Math.min(messages.length, 3); i++) {
        const message = messages[i];
        const messageText = extractMessageText(message);

        console.log(`📧 メッセージ #${i + 1}:`);
        console.log(`   ID: ${message.message_id}`);
        console.log(`   From: ${message.account.name} (ID: ${message.account.account_id})`);
        console.log(`   Date: ${new Date(message.send_time * 1000).toLocaleString('ja-JP')}`);
        console.log(`   Body (raw): ${message.body.substring(0, 100)}...`);
        console.log(`   Body (extracted): ${messageText.substring(0, 100)}...`);
        console.log(`   Body length: ${messageText.length} characters\n`);

        // 自分自身のメッセージかチェック
        if (message.account.account_id === myId) {
          console.log('   ⚠️  自分自身のメッセージ（無限ループ防止で除外されます）\n');
        }
      }
    }

    console.log('✅ すべてのテストが成功しました！\n');
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error('\nトラブルシューティング:');
    console.error('1. Chatwork APIトークンが有効か確認してください');
    console.error('2. APIトークンに必要な権限があるか確認してください');
    console.error('3. Chatwork APIのレート制限に達していないか確認してください');
    if (error.message.includes('401')) {
      console.error('4. APIトークンが無効または期限切れの可能性があります');
    }
    if (error.message.includes('403')) {
      console.error('4. APIトークンに必要な権限がない可能性があります');
    }
    process.exit(1);
  }
}

testChatworkAPI();

