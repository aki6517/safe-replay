/**
 * LIFF（LINE Front-end Framework）用エンドポイント
 * ユーザーのオンボーディング画面を提供
 */
import { Hono } from 'hono';
import { getBaseUrlFromRequest, joinBaseUrl } from '../utils/base-url';

export const liffRouter = new Hono();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function htmlResponse(content: string): Response {
  return new Response(content, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    }
  });
}

/**
 * LIFF メインページ（オンボーディング）
 */
liffRouter.get('/', (c) => {
  const liffId = escapeHtml(process.env.LIFF_ID || '');
  const googleClientId = escapeHtml(process.env.GMAIL_WEB_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '');
  const baseUrl = escapeHtml(getBaseUrlFromRequest(c.req.url));
  const gmailRedirectUri = escapeHtml(joinBaseUrl(getBaseUrlFromRequest(c.req.url), '/api/oauth/gmail/callback'));
  const slackStartUrl = escapeHtml(joinBaseUrl(getBaseUrlFromRequest(c.req.url), '/api/oauth/slack/start'));

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SafeReply 設定</title>
      <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 420px;
          margin: 0 auto;
        }

        .card {
          background: white;
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
        }

        .header h1 {
          font-size: 24px;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .header p {
          color: #666;
          font-size: 14px;
        }

        .step {
          margin-bottom: 25px;
        }

        .step-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }

        .step-number {
          width: 28px;
          height: 28px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          margin-right: 10px;
        }

        .step-number.completed {
          background: #10b981;
        }

        .step-title {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .btn {
          width: 100%;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-gmail {
          background: #fff;
          border: 2px solid #ea4335;
          color: #ea4335;
        }

        .btn-gmail:hover {
          background: #ea4335;
          color: white;
        }

        .btn-gmail.connected {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }

        .btn-chatwork {
          background: #fff;
          border: 2px solid #f7623b;
          color: #f7623b;
        }

        .btn-chatwork:hover {
          background: #f7623b;
          color: white;
        }

        .btn-slack {
          background: #fff;
          border: 2px solid #4a154b;
          color: #4a154b;
        }

        .btn-slack:hover {
          background: #4a154b;
          color: white;
        }

        .btn-slack.connected {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }

        .btn-complete {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-top: 20px;
        }

        .btn-complete:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .input-group {
          margin-top: 12px;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          color: #666;
          margin-bottom: 6px;
        }

        .input-group input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .input-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .help-link {
          display: block;
          text-align: right;
          font-size: 12px;
          color: #667eea;
          margin-top: 8px;
          text-decoration: none;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          margin-top: 8px;
          color: #4b5563;
          line-height: 1.5;
        }

        .status.connected {
          color: #10b981;
        }

        .status.pending {
          color: #f59e0b;
        }

        .loading {
          display: none;
          text-align: center;
          padding: 40px;
        }

        .loading.show {
          display: block;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .success-message {
          display: none;
          text-align: center;
          padding: 40px 20px;
        }

        .success-message.show {
          display: block;
        }

        .success-icon {
          font-size: 60px;
          margin-bottom: 20px;
        }

        .success-message h2 {
          color: #10b981;
          margin-bottom: 10px;
        }

        .success-message p {
          color: #666;
          font-size: 14px;
        }

        .optional-badge {
          background: #f3f4f6;
          color: #666;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 8px;
        }

        .workspace-list {
          margin-top: 8px;
          padding-left: 18px;
          color: #4b5563;
          font-size: 12px;
        }

        .workspace-list li {
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>読み込み中...</p>
          </div>

          <div class="success-message" id="successMessage">
            <div class="success-icon">🎉</div>
            <h2>設定完了！</h2>
            <p>SafeReplyがメッセージを監視して<br>LINEにお知らせします。</p>
            <button class="btn btn-complete" onclick="liff.closeWindow()">閉じる</button>
          </div>

          <div id="mainContent" style="display: none;">
            <div class="header">
              <h1>🛡️ SafeReply</h1>
              <p>サービスを連携して始めましょう</p>
            </div>

            <div class="step">
              <div class="step-header">
                <div class="step-number" id="step1Number">1</div>
                <span class="step-title">📧 Gmail連携</span>
              </div>
              <button class="btn btn-gmail" id="gmailBtn" onclick="connectGmail()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                </svg>
                Gmailを連携する
              </button>
              <div class="status" id="gmailStatus"></div>
            </div>

            <div class="step">
              <div class="step-header">
                <div class="step-number" id="step2Number">2</div>
                <span class="step-title">💬 Chatwork連携</span>
                <span class="optional-badge">任意</span>
              </div>
              <div class="input-group">
                <label>APIトークン</label>
                <input type="text" id="chatworkToken" placeholder="APIトークンを入力">
                <a href="https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php"
                   target="_blank" class="help-link">
                  📖 トークンの取得方法
                </a>
              </div>
              <button class="btn btn-chatwork" id="chatworkBtn" onclick="saveChatworkToken()" style="margin-top: 12px;">
                保存する
              </button>
              <div class="status" id="chatworkStatus"></div>
            </div>

            <div class="step">
              <div class="step-header">
                <div class="step-number" id="step3Number">3</div>
                <span class="step-title">💼 Slack連携</span>
                <span class="optional-badge">任意</span>
              </div>
              <button class="btn btn-slack" id="slackBtn" onclick="connectSlack()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 1 1-2.528 2.528h2.528v-2.528zm1.274 0a2.528 2.528 0 0 1 5.056 0v6.321a2.528 2.528 0 1 1-5.056 0v-6.321zm2.528-10.123a2.528 2.528 0 1 1-2.528-2.528v2.528h2.528zm0 1.274a2.528 2.528 0 0 1 0 5.056H2.528a2.528 2.528 0 1 1 0-5.056h6.316zm10.123 2.528a2.528 2.528 0 1 1 2.528-2.528v2.528h-2.528zm-1.274 0a2.528 2.528 0 0 1-5.056 0V2.528a2.528 2.528 0 1 1 5.056 0v6.316zm-2.528 10.123a2.528 2.528 0 1 1 2.528 2.528v-2.528h-2.528zm0-1.274a2.528 2.528 0 0 1 0-5.056h6.321a2.528 2.528 0 1 1 0 5.056h-6.321z"/>
                </svg>
                Slackを連携する
              </button>
              <div class="status" id="slackStatus"></div>
              <ul class="workspace-list" id="slackWorkspaceList" style="display: none;"></ul>
            </div>

            <button class="btn btn-complete" id="completeBtn" onclick="completeSetup()">
              ✨ 設定を完了する
            </button>
          </div>
        </div>
      </div>

      <script>
        const apiBaseUrl = '${baseUrl}';
        const slackStartUrl = '${slackStartUrl}';
        let lineUserId = null;
        let userProfile = null;
        let slackOauthConfigured = false;

        async function initLiff() {
          try {
            document.getElementById('loading').classList.add('show');

            await liff.init({ liffId: '${liffId}' });

            if (!liff.isLoggedIn()) {
              liff.login();
              return;
            }

            userProfile = await liff.getProfile();
            lineUserId = userProfile.userId;

            const response = await fetch(apiBaseUrl + '/api/user/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineUserId })
            });

            const data = await response.json();

            document.getElementById('loading').classList.remove('show');
            document.getElementById('mainContent').style.display = 'block';

            slackOauthConfigured = !!data.slackOauthConfigured;

            if (data.gmailConnected) {
              setGmailConnected();
            }
            if (data.chatworkConnected) {
              setChatworkConnected();
            }
            if (data.slackConnected) {
              setSlackConnected(data.slackWorkspaces || []);
            } else if (!slackOauthConfigured) {
              setSlackUnavailable();
            }
          } catch (error) {
            console.error('LIFF init error:', error);
            alert('初期化エラー: ' + error.message);
          }
        }

        function connectGmail() {
          const redirectUri = encodeURIComponent('${gmailRedirectUri}');
          const state = encodeURIComponent(lineUserId);
          const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send');

          const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
            'client_id=${googleClientId}&' +
            'redirect_uri=' + redirectUri + '&' +
            'response_type=code&' +
            'scope=' + scope + '&' +
            'access_type=offline&' +
            'prompt=consent&' +
            'state=' + state;

          liff.openWindow({ url: authUrl, external: true });
        }

        function setGmailConnected() {
          document.getElementById('step1Number').classList.add('completed');
          document.getElementById('step1Number').textContent = '✓';
          document.getElementById('gmailBtn').classList.add('connected');
          document.getElementById('gmailBtn').innerHTML = '✅ 連携済み';
          document.getElementById('gmailBtn').disabled = true;
          document.getElementById('gmailStatus').innerHTML = '<span class="status connected">✓ Gmailと連携しました</span>';
        }

        async function saveChatworkToken() {
          const token = document.getElementById('chatworkToken').value.trim();
          if (!token) {
            alert('APIトークンを入力してください');
            return;
          }

          try {
            const response = await fetch(apiBaseUrl + '/api/user/chatwork', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineUserId, chatworkToken: token })
            });

            if (response.ok) {
              setChatworkConnected();
            } else {
              alert('保存に失敗しました');
            }
          } catch (error) {
            alert('エラー: ' + error.message);
          }
        }

        function setChatworkConnected() {
          document.getElementById('step2Number').classList.add('completed');
          document.getElementById('step2Number').textContent = '✓';
          document.getElementById('chatworkBtn').disabled = true;
          document.getElementById('chatworkStatus').innerHTML = '<span class="status connected">✓ Chatworkと連携しました</span>';
        }

        function connectSlack() {
          if (!slackOauthConfigured) {
            alert('Slack OAuthがまだ設定されていません');
            return;
          }

          const url = slackStartUrl + '?line_user_id=' + encodeURIComponent(lineUserId);
          liff.openWindow({ url, external: true });
        }

        function setSlackUnavailable() {
          document.getElementById('slackBtn').disabled = true;
          document.getElementById('slackStatus').innerHTML = '<span class="status pending">Slack連携は現在未設定です</span>';
        }

        function setSlackConnected(workspaces) {
          document.getElementById('step3Number').classList.add('completed');
          document.getElementById('step3Number').textContent = '✓';
          document.getElementById('slackBtn').classList.add('connected');
          document.getElementById('slackBtn').innerHTML = '✅ Slack追加連携';
          document.getElementById('slackStatus').innerHTML =
            '<span class="status connected">✓ Slackと連携しました（' + workspaces.length + ' workspace）</span>';

          const workspaceList = document.getElementById('slackWorkspaceList');
          if (workspaces.length > 0) {
            workspaceList.innerHTML = workspaces.map((workspace) => {
              const label = workspace.teamName || workspace.teamId || 'Workspace';
              return '<li>' + label + '</li>';
            }).join('');
            workspaceList.style.display = 'block';
          } else {
            workspaceList.style.display = 'none';
          }
        }

        async function completeSetup() {
          try {
            const response = await fetch(apiBaseUrl + '/api/user/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineUserId })
            });

            if (response.ok) {
              document.getElementById('mainContent').style.display = 'none';
              document.getElementById('successMessage').classList.add('show');
            } else {
              alert('Gmailの連携が必要です');
            }
          } catch (error) {
            alert('エラー: ' + error.message);
          }
        }

        initLiff();
      </script>
    </body>
    </html>
  `;

  return htmlResponse(htmlContent);
});

/**
 * OAuth コールバック後の成功ページ
 */
liffRouter.get('/callback/success', (c) => {
  const provider = escapeHtml(c.req.query('provider') || 'Gmail');
  const title = `${provider}連携完了！`;
  const description = (c.req.query('provider') || 'Gmail') === 'Slack'
    ? 'Slackとの連携が完了しました。LINEアプリに戻って設定を続けてください。'
    : 'LINEアプリに戻って設定を完了してください。';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>連携完了 - SafeReply</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 350px;
        }
        .icon { font-size: 60px; margin-bottom: 20px; }
        h1 { color: #10b981; margin-bottom: 10px; font-size: 24px; }
        p { color: #666; font-size: 14px; margin-bottom: 20px; line-height: 1.6; }
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
        <div class="icon">✅</div>
        <h1>${title}</h1>
        <p>${description}</p>
        <a href="https://line.me/R/" class="btn">LINEに戻る</a>
      </div>
    </body>
    </html>
  `;
  return htmlResponse(htmlContent);
});

/**
 * OAuth コールバック後のエラーページ
 */
liffRouter.get('/callback/error', (c) => {
  const reason = escapeHtml(c.req.query('reason') || 'unknown');

  const htmlContent = `
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
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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
          word-break: break-word;
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
  `;
  return htmlResponse(htmlContent);
});
