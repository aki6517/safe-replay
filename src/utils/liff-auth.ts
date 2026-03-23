/**
 * LIFF ID Token検証
 * LINE Login APIでIDトークンを検証し、LINE User IDを返す
 */
export async function verifyLiffIdToken(idToken: string): Promise<string | null> {
  const channelId = process.env.LIFF_CHANNEL_ID || process.env.LINE_CHANNEL_ID;
  if (!channelId) {
    console.warn('[LIFF Auth] LIFF_CHANNEL_ID not configured, skipping verification');
    return null;
  }

  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId })
    });

    if (!res.ok) return null;
    const data = await res.json() as { sub?: string };
    return data.sub || null;
  } catch (error) {
    console.error('[LIFF Auth] Token verification failed:', error);
    return null;
  }
}

/**
 * リクエストからLINE User IDを取得
 * Authorization: Bearer <ID_TOKEN>ヘッダーがあればID Token検証を優先。
 * なければリクエストボディのlineUserIdにフォールバック（後方互換）。
 */
export async function getAuthenticatedLineUserId(
  authHeader: string | undefined,
  bodyLineUserId: string | undefined
): Promise<string | null> {
  // ID Token検証を試行
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    const verifiedUserId = await verifyLiffIdToken(idToken);
    if (verifiedUserId) return verifiedUserId;
  }

  // フォールバック: ボディのlineUserId（開発環境のみ推奨）
  if (bodyLineUserId) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[LIFF Auth] Using unverified lineUserId in production');
    }
    return bodyLineUserId;
  }

  return null;
}
