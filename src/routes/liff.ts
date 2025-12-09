/**
 * LIFF（LINE Front-end Framework）用エンドポイント
 * ユーザーのオンボーディング画面を提供
 */
import { Hono } from 'hono';
import { html } from 'hono/html';

export const liffRouter = new Hono();

const LIFF_ID = process.env.LIFF_ID || '';
// LIFF用OAuth（ウェブアプリケーションクライアント）
const GOOGLE_CLIENT_ID = process.env.GMAIL_WEB_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '';
const BASE_URL = process.env.BASE_URL || 'https://your-app.railway.app';

/**
 * LIFF メインページ（オンボーディング）
 */
liffRouter.get('/', (c) => {
  const htmlContent = html`
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
          max-width: 400px;
          margin: 0 auto;
        }
        
        .card {
          background: white;
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
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
          to { transform: rotate(360deg); }
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
            <p>SafeReplyがメールを監視して<br>LINEにお知らせします。</p>
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
              <button class="btn btn-chatwork" onclick="saveChatworkToken()" style="margin-top: 12px;">
                保存する
              </button>
              <div class="status" id="chatworkStatus"></div>
            </div>
            
            <button class="btn btn-complete" id="completeBtn" onclick="completeSetup()">
              ✨ 設定を完了する
            </button>
          </div>
        </div>
      </div>
      
      <script>
        let lineUserId = null;
        let userProfile = null;
        
        // LIFF初期化
        async function initLiff() {
          try {
            document.getElementById('loading').classList.add('show');
            
            await liff.init({ liffId: '${LIFF_ID}' });
            
            if (!liff.isLoggedIn()) {
              liff.login();
              return;
            }
            
            // プロフィール取得
            userProfile = await liff.getProfile();
            lineUserId = userProfile.userId;
            
            // ユーザー登録・状態確認
            const response = await fetch('/api/user/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineUserId })
            });
            
            const data = await response.json();
            
            document.getElementById('loading').classList.remove('show');
            document.getElementById('mainContent').style.display = 'block';
            
            // 既存の連携状態を表示
            if (data.gmailConnected) {
              setGmailConnected();
            }
            if (data.chatworkConnected) {
              setChatworkConnected();
            }
            
          } catch (error) {
            console.error('LIFF init error:', error);
            alert('初期化エラー: ' + error.message);
          }
        }
        
        // Gmail連携
        function connectGmail() {
          const redirectUri = encodeURIComponent('${BASE_URL}/api/oauth/gmail/callback');
          const state = encodeURIComponent(lineUserId);
          const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send');
          
          const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
            'client_id=${GOOGLE_CLIENT_ID}&' +
            'redirect_uri=' + redirectUri + '&' +
            'response_type=code&' +
            'scope=' + scope + '&' +
            'access_type=offline&' +
            'prompt=consent&' +
            'state=' + state;
          
          // 外部ブラウザで開く
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
        
        // Chatworkトークン保存
        async function saveChatworkToken() {
          const token = document.getElementById('chatworkToken').value.trim();
          if (!token) {
            alert('APIトークンを入力してください');
            return;
          }
          
          try {
            const response = await fetch('/api/user/chatwork', {
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
          document.getElementById('chatworkStatus').innerHTML = '<span class="status connected">✓ Chatworkと連携しました</span>';
        }
        
        // 設定完了
        async function completeSetup() {
          try {
            const response = await fetch('/api/user/complete', {
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
        
        // 初期化実行
        initLiff();
      </script>
    </body>
    </html>
  `;

  return c.html(htmlContent);
});

/**
 * Gmail OAuth コールバック後のリダイレクトページ
 */
liffRouter.get('/callback/success', (c) => {
  const htmlContent = html`
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
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 350px;
        }
        .icon { font-size: 60px; margin-bottom: 20px; }
        h1 { color: #10b981; margin-bottom: 10px; font-size: 24px; }
        p { color: #666; font-size: 14px; margin-bottom: 20px; }
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
        <h1>Gmail連携完了！</h1>
        <p>LINEアプリに戻って<br>設定を完了してください。</p>
        <a href="https://line.me/R/" class="btn">LINEに戻る</a>
      </div>
    </body>
    </html>
  `;
  return c.html(htmlContent);
});

