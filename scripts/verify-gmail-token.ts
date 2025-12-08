/**
 * Gmail APIトークン検証スクリプト
 * 
 * 定期的に実行することで、リフレッシュトークンの6ヶ月失効を防ぐ
 * GitHub Actionsのcron jobで実行することを想定
 */

import { verifyGmailToken } from '../src/services/gmail';

async function main() {
  console.log('=== Gmail APIトークン検証 ===\n');

  try {
    const isValid = await verifyGmailToken();

    if (isValid) {
      console.log('✅ Gmail APIトークンは有効です');
      process.exit(0);
    } else {
      console.error('❌ Gmail APIトークンが無効または利用できません');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ トークン検証エラー:', error.message);
    process.exit(1);
  }
}

main();



