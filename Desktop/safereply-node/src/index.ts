/**
 * SafeReply エントリーポイント
 * Node.js + TypeScript + Hono
 */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { lineWebhook } from './routes/line-webhook';
import { pollRoutes } from './routes/poll';
import { healthRoutes } from './routes/health';

const app = new Hono();

// ミドルウェア
app.use('*', logger());
app.use('*', cors());
app.use('*', prettyJSON());

// ルート
app.route('/api/v1/line', lineWebhook);
app.route('/api/v1/poll', pollRoutes);
app.route('/api/v1/health', healthRoutes);

// ルートエンドポイント
app.get('/', (c) => {
  return c.json({
    name: 'SafeReply',
    version: '1.0.0',
    status: 'running',
    docs: 'https://github.com/your-repo/safereply'
  });
});

// 404
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// エラーハンドラー
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json(
    {
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message
      }
    },
    500
  );
});

// サーバー起動
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 SafeReply server running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});

