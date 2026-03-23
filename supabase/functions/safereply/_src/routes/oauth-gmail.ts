/**
 * Gmail OAuth コールバック
 * ユーザーがGoogleで認証後、トークンを保存
 */
import { Hono } from 'hono';
import { getSupabase, isSupabaseAvailable } from '../db/client.ts';
import { getBaseUrlFromRequest, getLiffWebBaseUrl, joinBaseUrl } from '../utils/base-url.ts';

export const oauthGmailRouter = new Hono();

type OAuthTokens = {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number | null;
};

async function exchangeCodeViaOAuthApi(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OAuth token exchange failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null
  };
}

async function getEmailAddressViaGmailApi(accessToken: string): Promise<string | undefined> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Failed to get profile via Gmail REST API: ${response.status} ${errorBody}`);
  }

  const profile = (await response.json()) as { emailAddress?: string };
  return profile.emailAddress;
}

/**
 * Gmail OAuth コールバック
 * Googleから認証コードを受け取り、トークンを取得・保存
 */
oauthGmailRouter.get('/callback', async (c) => {
  try {
    const apiBaseUrl = getBaseUrlFromRequest(c.req.url);
    const webBaseUrl = getLiffWebBaseUrl(c.req.url);
    const redirectUri = joinBaseUrl(apiBaseUrl, '/api/oauth/gmail/callback');
    const liffSuccessUrl = joinBaseUrl(webBaseUrl, '/callback/success');
    const liffErrorBaseUrl = joinBaseUrl(webBaseUrl, '/callback/error');
    const googleClientId = process.env.GMAIL_WEB_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '';
    const googleClientSecret = process.env.GMAIL_WEB_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || '';

    const code = c.req.query('code');
    const state = c.req.query('state'); // LINE User ID
    const error = c.req.query('error');

    if (error) {
      console.error('[Gmail OAuth エラー]', error);
      return c.redirect(`${liffErrorBaseUrl}?reason=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.redirect(`${liffErrorBaseUrl}?reason=missing_params`);
    }

    const lineUserId = decodeURIComponent(state);

    if (!googleClientId || !googleClientSecret) {
      return c.redirect(`${liffErrorBaseUrl}?reason=gmail_oauth_not_configured`);
    }

    const tokens = await exchangeCodeViaOAuthApi(code, googleClientId, googleClientSecret, redirectUri);
    
    if (!tokens.refresh_token) {
      console.error('[Gmail OAuth] refresh_token が取得できませんでした');
      return c.redirect(`${liffErrorBaseUrl}?reason=no_refresh_token`);
    }

    let emailAddress: string | undefined;
    if (tokens.access_token) {
      emailAddress = await getEmailAddressViaGmailApi(tokens.access_token);
    }

    // DBに保存
    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return c.redirect(`${liffErrorBaseUrl}?reason=db_unavailable`);
    }

    const { error: updateError } = await (supabase.from('users') as any)
      .update({
        gmail_refresh_token: tokens.refresh_token,
        gmail_access_token: tokens.access_token,
        gmail_token_expires_at: tokens.expiry_date 
          ? new Date(tokens.expiry_date).toISOString() 
          : null,
        gmail_email: emailAddress,
        updated_at: new Date().toISOString()
      })
      .eq('line_user_id', lineUserId);

    if (updateError) {
      console.error('[Gmail トークン保存エラー]', updateError);
      return c.redirect(`${liffErrorBaseUrl}?reason=save_failed`);
    }

    console.log('[Gmail OAuth 完了]', { lineUserId, emailAddress });
    
    // 成功ページにリダイレクト
    return c.redirect(liffSuccessUrl);

  } catch (error: any) {
    console.error('[Gmail OAuth エラー]', error);
    const webBaseUrl = getLiffWebBaseUrl(c.req.url);
    const liffErrorBaseUrl = joinBaseUrl(webBaseUrl, '/callback/error');
    return c.redirect(`${liffErrorBaseUrl}?reason=${encodeURIComponent(error.message)}`);
  }
});

/**
 * エラーページ
 */
oauthGmailRouter.get('/error', (c) => {
  const reason = c.req.query('reason') || 'unknown';
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>エラー - SafeReply</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 350px;
        }
        .icon { font-size: 60px; margin-bottom: 20px; }
        h1 { color: #ef4444; margin-bottom: 10px; font-size: 24px; }
        p { color: #666; font-size: 14px; margin-bottom: 20px; }
        .error-detail { 
          background: #fef2f2; 
          padding: 10px; 
          border-radius: 8px; 
          font-size: 12px; 
          color: #991b1b;
          margin-bottom: 20px;
        }
        .btn {
          display: inline-block;
          background: #06c755;
          color: white;
          padding: 14px 30px;
          border-radius: 25px;
          text-decoration: none;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">❌</div>
        <h1>連携に失敗しました</h1>
        <p>もう一度お試しください。</p>
        <div class="error-detail">${reason}</div>
        <a href="https://line.me/R/" class="btn">LINEに戻る</a>
      </div>
    </body>
    </html>
  `);
});
