/**
 * Supabase Edge Functions entrypoint
 * SafeReply API を Edge Runtime (Deno) で提供する。
 */
type RuntimeProcess = {
  env: Record<string, string | undefined>;
  uptime: () => number;
};

function ensureProcessCompatForDeno(): void {
  const current = (globalThis as { process?: RuntimeProcess }).process;
  if (current) {
    return;
  }

  const envProxy = new Proxy<Record<string, string | undefined>>(
    {},
    {
      get: (_target, prop) => Deno.env.get(String(prop)),
      has: (_target, prop) => Deno.env.get(String(prop)) !== undefined,
      ownKeys: () => Object.keys(Deno.env.toObject()),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
    }
  );

  (globalThis as { process?: RuntimeProcess }).process = {
    env: envProxy,
    uptime: () => performance.now() / 1000
  };
}

ensureProcessCompatForDeno();

type AppBootstrapResult =
  | { ok: true; app: { fetch: (req: Request) => Promise<Response> | Response } }
  | { ok: false; errorMessage: string; errorStack?: string };

const appPromise: Promise<AppBootstrapResult> = (async () => {
  try {
    const { createApp } = await import('./_src/app.ts');
    return { ok: true, app: createApp() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[safereply] bootstrap error:', errorMessage, errorStack ?? '');
    return { ok: false, errorMessage, errorStack };
  }
})();

function normalizeSupabaseFunctionsPath(req: Request): Request {
  const url = new URL(req.url);
  const originalPathname = url.pathname;
  const withoutGatewayPrefix = originalPathname.replace(
    /^\/functions\/v1\/[^/]+(?=\/|$)/,
    ''
  );
  const normalizedPathname = withoutGatewayPrefix.replace(/^\/safereply(?=\/|$)/, '');

  if (normalizedPathname === originalPathname) {
    return req;
  }

  url.pathname = normalizedPathname || '/';
  return new Request(url.toString(), req);
}

Deno.serve(async (req) => {
  const boot = await appPromise;
  if (!boot.ok) {
    return new Response(
      JSON.stringify(
        {
          status: 'error',
          code: 'BOOTSTRAP_ERROR',
          message: boot.errorMessage,
          stack: boot.errorStack
        },
        null,
        2
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const normalizedReq = normalizeSupabaseFunctionsPath(req);
  return boot.app.fetch(normalizedReq);
});
