/**
 * SafeReply 共通アプリケーション定義
 * Node.js / Supabase Edge Functions の両方から利用する。
 */
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { lineWebhook } from './routes/line-webhook';
import { pollRoutes } from './routes/poll';
import { healthRoutes } from './routes/health';
import { liffRouter } from './routes/liff';
import { userApiRouter } from './routes/user-api';
import { oauthGmailRouter } from './routes/oauth-gmail';
import { oauthSlackRouter } from './routes/oauth-slack';
import { slackEventsRouter } from './routes/slack-events';
import { stripeWebhook } from './routes/stripe-webhook';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());
  app.use('*', prettyJSON());

  app.route('/api/v1/line', lineWebhook);
  app.route('/api/v1/poll', pollRoutes);
  app.route('/api/v1/health', healthRoutes);
  app.route('/api/v1/slack', slackEventsRouter);
  app.route('/liff', liffRouter);
  app.route('/api/user', userApiRouter);
  app.route('/api/oauth/gmail', oauthGmailRouter);
  app.route('/api/oauth/slack', oauthSlackRouter);
  app.route('/api/v1/stripe', stripeWebhook);

  app.get('/', (c) => {
    return c.json({
      name: 'SafeReply',
      version: '1.0.0',
      status: 'running',
      docs: 'https://github.com/your-repo/safereply'
    });
  });

  app.notFound((c) => {
    return c.json({ error: 'Not Found' }, 404);
  });

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

  return app;
}
