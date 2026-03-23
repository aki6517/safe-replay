/**
 * SafeReply エントリーポイント
 * Node.js + TypeScript + Hono
 */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app';

// サーバー起動
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 SafeReply server running on port ${port}`);
const app = createApp();

serve({
  fetch: app.fetch,
  port
});
