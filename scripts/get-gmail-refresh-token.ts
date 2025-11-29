/**
 * Gmail API用のリフレッシュトークンを取得するスクリプト
 * 
 * 使用方法:
 * 1. .envファイルにGMAIL_CLIENT_IDとGMAIL_CLIENT_SECRETを設定
 * 2. npm run get-gmail-refresh-token を実行
 * 3. ブラウザで認証URLを開いて認証
 * 4. 表示された認証コードを入力
 * 5. リフレッシュトークンが表示されるので、.envファイルに追加
 */
import { google } from 'googleapis';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function getRefreshToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ エラー: GMAIL_CLIENT_IDとGMAIL_CLIENT_SECRETを.envファイルに設定してください');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // リダイレクトURI（デスクトップアプリ用）
  );

  // 認証URLを生成
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // リフレッシュトークンを確実に取得するため
  });

  console.log('🔐 Gmail API認証を開始します\n');
  console.log('以下のURLをブラウザで開いて認証してください:');
  console.log('\n' + authUrl + '\n');

  // 認証コードを入力
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('認証後に表示されたコードを入力してください: ', async (code) => {
    rl.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log('\n✅ 認証成功！\n');
      console.log('以下のリフレッシュトークンを.envファイルに追加してください:\n');
      console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
      
      if (tokens.refresh_token) {
        console.log('✅ リフレッシュトークンが取得できました');
      } else {
        console.log('⚠️  リフレッシュトークンが取得できませんでした');
        console.log('   既に認証済みの場合は、既存のリフレッシュトークンを使用してください');
      }
    } catch (error: any) {
      console.error('\n❌ エラー:', error.message);
      console.error('認証コードが正しくない可能性があります');
      process.exit(1);
    }
  });
}

getRefreshToken();

