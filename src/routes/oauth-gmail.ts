/**
 * Gmail OAuth コールバック
 * ユーザーがGoogleで認証後、トークンを保存
 */
import { Hono } from 'hono';
import { google } from 'googleapis';
import { getSupabase, isSupabaseAvailable } from '../db/client';

export const oauthGmailRouter = new Hono();

const GOOGLE_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'https://your-app.railway.app';
const REDIRECT_URI = `${BASE_URL}/api/oauth/gmail/callback`;

/**
 * Gmail OAuth コールバック
 * Googleから認証コードを受け取り、トークンを取得・保存
 */
oauthGmailRouter.get('/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state'); // LINE User ID
    const error = c.req.query('error');

    if (error) {
      console.error('[Gmail OAuth エラー]', error);
      return c.redirect('/liff/callback/error?reason=' + encodeURIComponent(error));
    }

    if (!code || !state) {
      return c.redirect('/liff/callback/error?reason=missing_params');
    }

    const lineUserId = decodeURIComponent(state);

    // OAuth2クライアントを作成
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    // 認証コードをトークンに交換
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      console.error('[Gmail OAuth] refresh_token が取得できませんでした');
      return c.redirect('/liff/callback/error?reason=no_refresh_token');
    }

    // ユーザーのメールアドレスを取得
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const emailAddress = profile.data.emailAddress;

    // DBに保存
    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return c.redirect('/liff/callback/error?reason=db_unavailable');
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
      return c.redirect('/liff/callback/error?reason=save_failed');
    }

    console.log('[Gmail OAuth 完了]', { lineUserId, emailAddress });
    
    // 成功ページにリダイレクト
    return c.redirect('/liff/callback/success');

  } catch (error: any) {
    console.error('[Gmail OAuth エラー]', error);
    return c.redirect('/liff/callback/error?reason=' + encodeURIComponent(error.message));
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

