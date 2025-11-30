/**
 * ホワイトリスト検証機能のテストスクリプト
 */
import 'dotenv/config';
import { isUserAllowedSync, isUserAllowed } from '../src/utils/security';

async function main() {
  console.log('=== ホワイトリスト検証機能のテスト ===\n');

  // 環境変数からホワイトリストを取得
  const whitelist = process.env.LINE_ALLOWED_USER_IDS;
  console.log('環境変数 LINE_ALLOWED_USER_IDS:', whitelist || '(未設定)');
  console.log('');

  // テスト用のユーザーID
  const testUserId = process.env.LINE_TEST_USER_ID || 'test_user_id_123';
  const allowedUserIds = whitelist
    ? whitelist.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : [];

  console.log('--- テスト1: 同期版ホワイトリストチェック ---\n');
  console.log(`テストユーザーID: ${testUserId}`);
  console.log(`許可されたユーザーIDリスト: ${allowedUserIds.length > 0 ? allowedUserIds.join(', ') : '(なし)'}`);
  console.log('');

  // 同期版のテスト
  const syncResult = isUserAllowedSync(testUserId);
  console.log(`同期版チェック結果: ${syncResult ? '✅ 許可' : '❌ 拒否'}`);
  console.log('');

  // 非同期版のテスト
  console.log('--- テスト2: 非同期版ホワイトリストチェック ---\n');
  const asyncResult = await isUserAllowed(testUserId);
  console.log(`非同期版チェック結果: ${asyncResult ? '✅ 許可' : '❌ 拒否'}`);
  console.log('');

  // 許可されたユーザーIDのテスト
  if (allowedUserIds.length > 0) {
    console.log('--- テスト3: 許可されたユーザーIDのチェック ---\n');
    for (const allowedId of allowedUserIds) {
      const result = isUserAllowedSync(allowedId);
      console.log(`ユーザーID: ${allowedId} → ${result ? '✅ 許可' : '❌ 拒否'}`);
    }
    console.log('');
  }

  // 未登録ユーザーIDのテスト
  console.log('--- テスト4: 未登録ユーザーIDのチェック ---\n');
  const unregisteredUserId = 'unregistered_user_999';
  const unregisteredResult = isUserAllowedSync(unregisteredUserId);
  console.log(`ユーザーID: ${unregisteredUserId} → ${unregisteredResult ? '✅ 許可' : '❌ 拒否'}`);
  console.log('');

  // null/undefinedのテスト
  console.log('--- テスト5: null/undefinedのチェック ---\n');
  const nullResult = isUserAllowedSync(null);
  const undefinedResult = isUserAllowedSync(undefined);
  console.log(`null → ${nullResult ? '✅ 許可' : '❌ 拒否'}`);
  console.log(`undefined → ${undefinedResult ? '✅ 許可' : '❌ 拒否'}`);
  console.log('');

  console.log('=== テスト完了 ===\n');
  console.log('📝 注意事項:');
  console.log('  - 環境変数 LINE_ALLOWED_USER_IDS が設定されていない場合、');
  console.log('    開発環境では警告を出して許可されます');
  console.log('    本番環境では拒否されます');
  console.log('  - LINE Webhookでは、未登録ユーザーからのリクエストは');
  console.log('    処理をスキップしてログに記録されます');
}

main().catch(console.error);

