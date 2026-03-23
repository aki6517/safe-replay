/**
 * 実行環境に応じたSafeReplyのベースURLを解決する。
 * Supabase Functions配下では `/functions/v1/<function-name>` を維持する。
 */
export function getBaseUrlFromRequest(requestUrl: string): string {
  const configured = process.env.BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const url = new URL(requestUrl);
  const publicOrigin = url.hostname.endsWith('.supabase.co')
    ? `https://${url.host}`
    : url.origin;
  const segments = url.pathname.split('/').filter(Boolean);
  const isSupabaseFunctionPath = segments[0] === 'functions' && segments[1] === 'v1' && !!segments[2];
  const functionPrefix = isSupabaseFunctionPath ? `/functions/v1/${segments[2]}` : '';
  if (functionPrefix) {
    return `${publicOrigin}${functionPrefix}`;
  }

  if (url.hostname.endsWith('.supabase.co')) {
    return `${publicOrigin}/functions/v1/safereply`;
  }

  return publicOrigin;
}

export function getLiffWebBaseUrl(requestUrl: string): string {
  const configured = process.env.LIFF_WEB_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  return getBaseUrlFromRequest(requestUrl);
}

export function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
