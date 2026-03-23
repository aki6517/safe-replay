/**
 * Gmail API用のリフレッシュトークンを取得するスクリプト（googleapis非依存版）
 *
 * 使用方法:
 * 1. .envに GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET を設定
 * 2. npm run get-gmail-refresh-token を実行
 * 3. 表示されたURLをブラウザで開いて認証
 * 4. code を貼り付ける
 * 5. 出力された GMAIL_REFRESH_TOKEN を .env と Supabase Secrets に反映
 */
import * as readline from 'readline';
import * as dotenv from 'dotenv';

dotenv.config();

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

function createAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true'
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function exchangeCodeForTokens(params: {
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const payloadText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(payloadText) as Record<string, unknown>;
  } catch {
    payload = { raw: payloadText };
  }

  if (!response.ok) {
    const detail = typeof payload.error_description === 'string'
      ? payload.error_description
      : JSON.stringify(payload);
    throw new Error(`Token exchange failed (${response.status}): ${detail}`);
  }

  return payload;
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function getRefreshToken(): Promise<void> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('エラー: GMAIL_CLIENT_ID と GMAIL_CLIENT_SECRET を .env に設定してください');
    process.exit(1);
  }

  const authUrl = createAuthUrl(clientId);
  console.log('Gmail API認証を開始します');
  console.log('以下のURLをブラウザで開いて認証してください:\n');
  console.log(authUrl);
  console.log('\n認証後に code をコピーして貼り付けてください。\n');
  console.log(`使用中の redirect_uri: ${redirectUri}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const code = (await question(rl, '認証コード: ')).trim();
    if (!code) {
      throw new Error('認証コードが空です');
    }

    const tokens = await exchangeCodeForTokens({ clientId, clientSecret, code });
    const refreshToken =
      typeof tokens.refresh_token === 'string' ? tokens.refresh_token : undefined;

    console.log('\n認証成功');
    if (refreshToken) {
      console.log('\n以下を .env と Supabase Secrets に反映してください:\n');
      console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}\n`);
      console.log('Supabase更新コマンド:');
      console.log(
        'supabase secrets set GMAIL_REFRESH_TOKEN="<上の値>" --project-ref fnfrnjptwemcgjicxugc'
      );
    } else {
      console.log('refresh_token が返りませんでした。');
      console.log('同意画面で再同意を取り直すため、Googleアカウント側でSafeReply連携を一度削除して再実行してください。');
      console.log(`レスポンス: ${JSON.stringify(tokens)}`);
    }
  } catch (error: any) {
    console.error('\nエラー:', error?.message || error);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

void getRefreshToken();

