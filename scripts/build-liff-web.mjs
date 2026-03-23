import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'liff-web-dist');

function normalizeBaseUrl(value) {
  return value ? value.replace(/\/+$/, '') : '';
}

function getApiBaseUrl() {
  const fromBaseUrl = normalizeBaseUrl(process.env.BASE_URL);
  if (fromBaseUrl) {
    return fromBaseUrl;
  }

  const fromSupabaseUrl = normalizeBaseUrl(process.env.SUPABASE_URL);
  if (fromSupabaseUrl) {
    return `${fromSupabaseUrl}/functions/v1/safereply`;
  }

  return '';
}

function assertEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required to build the LIFF web frontend`);
  }

  return value;
}

function writeFile(relativePath, content) {
  const targetPath = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function buildMainPage({ liffId, gmailClientId, apiBaseUrl }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeReply 設定</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(160deg, #f4f7fb 0%, #e7eef8 100%);
      color: #172033;
      min-height: 100vh;
      padding: 24px 16px 40px;
    }
    .wrap {
      margin: 0 auto;
      max-width: 440px;
    }
    .card {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(23, 32, 51, 0.08);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(39, 66, 118, 0.16);
      overflow: hidden;
    }
    .hero {
      background:
        radial-gradient(circle at top right, rgba(96, 130, 255, 0.36), transparent 40%),
        linear-gradient(135deg, #172033 0%, #243a66 100%);
      color: #fff;
      padding: 28px 24px 22px;
    }
    .hero h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .hero p {
      font-size: 14px;
      line-height: 1.6;
      margin-top: 8px;
      opacity: 0.92;
    }
    .body {
      padding: 22px 18px 24px;
    }
    .section + .section {
      margin-top: 18px;
    }
    .section {
      border: 1px solid rgba(23, 32, 51, 0.08);
      border-radius: 18px;
      padding: 16px;
      background: #fff;
    }
    .section-head {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .step {
      align-items: center;
      background: #172033;
      border-radius: 999px;
      color: #fff;
      display: inline-flex;
      font-size: 12px;
      font-weight: 700;
      height: 28px;
      justify-content: center;
      width: 28px;
    }
    .step.done {
      background: #15a46d;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
    }
    .badge {
      background: #eef3fb;
      border-radius: 999px;
      color: #476181;
      font-size: 11px;
      font-weight: 700;
      margin-left: auto;
      padding: 5px 9px;
    }
    .button {
      appearance: none;
      border: none;
      border-radius: 14px;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      font-size: 15px;
      font-weight: 700;
      gap: 8px;
      justify-content: center;
      padding: 14px 16px;
      transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
      width: 100%;
    }
    .button:hover {
      box-shadow: 0 12px 24px rgba(23, 32, 51, 0.16);
      transform: translateY(-1px);
    }
    .button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      transform: none;
      box-shadow: none;
    }
    .gmail { background: #d93025; }
    .chatwork { background: #f26c4f; }
    .slack { background: #4a154b; }
    .complete { background: linear-gradient(135deg, #172033, #345fa3); margin-top: 22px; }
    .status {
      color: #476181;
      font-size: 13px;
      line-height: 1.6;
      margin-top: 10px;
      white-space: pre-line;
    }
    .status.ok { color: #0f8f5f; }
    .status.warn { color: #9b6a00; }
    .status.error { color: #b42318; }
    .field {
      margin-top: 12px;
    }
    .field label {
      color: #476181;
      display: block;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .field input {
      border: 1px solid rgba(23, 32, 51, 0.12);
      border-radius: 12px;
      font-size: 14px;
      padding: 12px 14px;
      width: 100%;
    }
    .help {
      color: #345fa3;
      display: inline-block;
      font-size: 12px;
      margin-top: 8px;
      text-decoration: none;
    }
    .workspace-list {
      color: #476181;
      font-size: 12px;
      margin: 10px 0 0 18px;
    }
    .loading,
    .done-panel {
      display: none;
      padding: 52px 24px;
      text-align: center;
    }
    .loading.show,
    .done-panel.show {
      display: block;
    }
    .spinner {
      animation: spin 1s linear infinite;
      border: 4px solid #d6e0f3;
      border-top-color: #345fa3;
      border-radius: 50%;
      height: 40px;
      margin: 0 auto 16px;
      width: 40px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .done-panel h2 {
      color: #0f8f5f;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .done-panel p {
      color: #476181;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 18px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="loading show" id="loading">
        <div class="spinner"></div>
        <p>読み込み中...</p>
      </div>

      <div class="done-panel" id="donePanel">
        <h2>設定完了</h2>
        <p>SafeReply が受信を監視し、LINE に通知します。</p>
        <button class="button complete" onclick="liff.closeWindow()">閉じる</button>
      </div>

      <div id="main" style="display:none;">
        <div class="hero">
          <h1>SafeReply 設定</h1>
          <p>Gmail・Chatwork・Slack を連携して、受信通知を LINE でまとめて受け取ります。</p>
        </div>

        <div class="body">
          <div class="section">
            <div class="section-head">
              <div class="step" id="stepGmail">1</div>
              <div class="section-title">Gmail 連携</div>
            </div>
            <button class="button gmail" id="gmailBtn" onclick="connectGmail()">Gmail を連携する</button>
            <div class="status" id="gmailStatus"></div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="step" id="stepChatwork">2</div>
              <div class="section-title">Chatwork 連携</div>
              <div class="badge">任意</div>
            </div>
            <div class="field">
              <label for="chatworkToken">APIトークン</label>
              <input type="text" id="chatworkToken" placeholder="Chatwork APIトークンを入力">
              <a class="help" href="https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php" target="_blank" rel="noreferrer">トークンの取得方法</a>
            </div>
            <button class="button chatwork" id="chatworkBtn" style="margin-top:12px;" onclick="saveChatworkToken()">保存する</button>
            <div class="status" id="chatworkStatus"></div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="step" id="stepSlack">3</div>
              <div class="section-title">Slack 連携</div>
              <div class="badge">任意</div>
            </div>
            <button class="button slack" id="slackBtn" onclick="connectSlack()">Slack を連携する</button>
            <div class="status" id="slackStatus"></div>
            <ul class="workspace-list" id="slackWorkspaces" style="display:none;"></ul>
          </div>

          <button class="button complete" onclick="completeSetup()">設定を完了する</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const liffId = ${JSON.stringify(liffId)};
    const apiBaseUrl = ${JSON.stringify(apiBaseUrl)};
    const gmailClientId = ${JSON.stringify(gmailClientId)};
    const gmailRedirectUri = apiBaseUrl + '/api/oauth/gmail/callback';
    const slackStartUrl = apiBaseUrl + '/api/oauth/slack/start';
    const gmailScope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';

    let lineUserId = null;
    let slackOauthConfigured = false;

    function setStep(stepId, done) {
      const step = document.getElementById(stepId);
      step.classList.toggle('done', done);
      step.textContent = done ? '✓' : step.textContent;
    }

    function setStatus(elementId, text, statusClass) {
      const element = document.getElementById(elementId);
      element.className = 'status' + (statusClass ? ' ' + statusClass : '');
      element.textContent = text;
    }

    async function initLiff() {
      try {
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        lineUserId = profile.userId;

        const response = await fetch(apiBaseUrl + '/api/user/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId })
        });

        if (!response.ok) {
          throw new Error('設定情報の取得に失敗しました');
        }

        const data = await response.json();
        slackOauthConfigured = !!data.slackOauthConfigured;

        if (data.gmailConnected) {
          setStep('stepGmail', true);
          document.getElementById('gmailBtn').textContent = 'Gmail 連携済み';
          document.getElementById('gmailBtn').disabled = true;
          setStatus('gmailStatus', 'Gmail と連携済みです。', 'ok');
        }

        if (data.chatworkConnected) {
          setStep('stepChatwork', true);
          document.getElementById('chatworkBtn').disabled = true;
          setStatus('chatworkStatus', 'Chatwork と連携済みです。', 'ok');
        }

        if (data.slackConnected) {
          setStep('stepSlack', true);
          document.getElementById('slackBtn').textContent = 'Slack を追加連携する';
          setStatus('slackStatus', 'Slack と連携済みです。', 'ok');
          const list = document.getElementById('slackWorkspaces');
          list.innerHTML = (data.slackWorkspaces || []).map((workspace) =>
            '<li>' + (workspace.teamName || workspace.teamId || 'Workspace') + '</li>'
          ).join('');
          list.style.display = (data.slackWorkspaces || []).length ? 'block' : 'none';
        } else if (!slackOauthConfigured) {
          document.getElementById('slackBtn').disabled = true;
          setStatus('slackStatus', 'Slack OAuth が未設定です。', 'warn');
        }

        document.getElementById('loading').classList.remove('show');
        document.getElementById('main').style.display = 'block';
      } catch (error) {
        console.error('LIFF init error', error);
        alert('初期化エラー: ' + (error && error.message ? error.message : String(error)));
      }
    }

    function connectGmail() {
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        'client_id=' + encodeURIComponent(gmailClientId) + '&' +
        'redirect_uri=' + encodeURIComponent(gmailRedirectUri) + '&' +
        'response_type=code&' +
        'scope=' + encodeURIComponent(gmailScope) + '&' +
        'access_type=offline&' +
        'prompt=consent&' +
        'state=' + encodeURIComponent(lineUserId);
      liff.openWindow({ url, external: true });
    }

    async function saveChatworkToken() {
      const token = document.getElementById('chatworkToken').value.trim();
      if (!token) {
        alert('Chatwork APIトークンを入力してください');
        return;
      }

      const response = await fetch(apiBaseUrl + '/api/user/chatwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, chatworkToken: token })
      });

      if (!response.ok) {
        alert('Chatworkトークンの保存に失敗しました');
        return;
      }

      setStep('stepChatwork', true);
      document.getElementById('chatworkBtn').disabled = true;
      setStatus('chatworkStatus', 'Chatwork と連携済みです。', 'ok');
    }

    function connectSlack() {
      if (!slackOauthConfigured) {
        alert('Slack OAuth が未設定です');
        return;
      }

      liff.openWindow({
        url: slackStartUrl + '?line_user_id=' + encodeURIComponent(lineUserId),
        external: true
      });
    }

    async function completeSetup() {
      const response = await fetch(apiBaseUrl + '/api/user/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId })
      });

      if (!response.ok) {
        alert('Gmail の連携が必要です');
        return;
      }

      document.getElementById('main').style.display = 'none';
      document.getElementById('donePanel').classList.add('show');
    }

    initLiff();
  </script>
</body>
</html>`;
}

function buildSuccessPage() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>連携完了 - SafeReply</title>
  <style>
    body {
      align-items: center;
      background: linear-gradient(135deg, #172033 0%, #345fa3 100%);
      color: #172033;
      display: flex;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 22px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
      max-width: 360px;
      padding: 36px 28px;
      text-align: center;
    }
    .icon { font-size: 52px; margin-bottom: 16px; }
    h1 { color: #0f8f5f; font-size: 24px; margin-bottom: 10px; }
    p { color: #476181; font-size: 14px; line-height: 1.7; margin-bottom: 18px; }
    .button {
      background: #06c755;
      border-radius: 999px;
      color: #fff;
      display: inline-block;
      font-weight: 700;
      padding: 14px 24px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1 id="title">連携完了</h1>
    <p id="description">LINEアプリに戻って設定を続けてください。</p>
    <a class="button" href="https://line.me/R/">LINE に戻る</a>
  </div>
  <script>
    const provider = new URLSearchParams(window.location.search).get('provider') || 'Gmail';
    document.getElementById('title').textContent = provider + ' 連携完了';
    document.getElementById('description').textContent =
      provider === 'Slack'
        ? 'Slack との連携が完了しました。LINE アプリへ戻って設定を続けてください。'
        : 'LINE アプリへ戻って設定を続けてください。';
  </script>
</body>
</html>`;
}

function buildErrorPage() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>連携エラー - SafeReply</title>
  <style>
    body {
      align-items: center;
      background: linear-gradient(135deg, #5f1616 0%, #b42318 100%);
      color: #172033;
      display: flex;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 22px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
      max-width: 380px;
      padding: 36px 28px;
      text-align: center;
    }
    .icon { font-size: 52px; margin-bottom: 16px; }
    h1 { color: #b42318; font-size: 24px; margin-bottom: 10px; }
    p { color: #476181; font-size: 14px; line-height: 1.7; margin-bottom: 14px; }
    code {
      background: #fff4f2;
      border-radius: 12px;
      color: #912018;
      display: block;
      font-size: 12px;
      margin-bottom: 20px;
      padding: 10px 12px;
      text-align: left;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .button {
      background: #06c755;
      border-radius: 999px;
      color: #fff;
      display: inline-block;
      font-weight: 700;
      padding: 14px 24px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>連携に失敗しました</h1>
    <p>内容を確認して、もう一度お試しください。</p>
    <code id="reason">unknown</code>
    <a class="button" href="https://line.me/R/">LINE に戻る</a>
  </div>
  <script>
    const reason = new URLSearchParams(window.location.search).get('reason') || 'unknown';
    document.getElementById('reason').textContent = reason;
  </script>
</body>
</html>`;
}

function buildVercelConfig() {
  return JSON.stringify(
    {
      cleanUrls: true,
      trailingSlash: false
    },
    null,
    2
  );
}

function main() {
  const liffId = assertEnv('LIFF_ID', process.env.LIFF_ID);
  const gmailClientId = assertEnv(
    'GMAIL_WEB_CLIENT_ID or GMAIL_CLIENT_ID',
    process.env.GMAIL_WEB_CLIENT_ID || process.env.GMAIL_CLIENT_ID
  );
  const apiBaseUrl = assertEnv('BASE_URL or SUPABASE_URL', getApiBaseUrl());

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  writeFile('index.html', buildMainPage({ liffId, gmailClientId, apiBaseUrl }));
  writeFile('callback/success/index.html', buildSuccessPage());
  writeFile('callback/error/index.html', buildErrorPage());
  writeFile('vercel.json', buildVercelConfig());

  console.log(`Built LIFF web frontend: ${path.relative(projectRoot, outputDir)}`);
  console.log(`API base: ${apiBaseUrl}`);
}

main();
