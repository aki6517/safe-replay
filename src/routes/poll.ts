/**
 * ポーリングAPI（Gmail/Chatwork）
 */
import { Hono } from 'hono';
import { pollGmail } from '../services/poller/gmail';
import { pollChatwork } from '../services/poller/chatwork';
import { pollGmailMultiUser } from '../services/poller/gmail-multi';

export const pollRoutes = new Hono();

// Service Key認証ミドルウェア
async function verifyServiceKey(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  const serviceKey = process.env.SERVICE_KEY;

  if (!serviceKey) {
    return c.json({ error: 'Service key not configured' }, 500);
  }

  if (authHeader !== `Bearer ${serviceKey}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
}

// Gmailポーリング
pollRoutes.post('/gmail', verifyServiceKey, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const lineUserId = body.user_id || body.line_user_id; // 後方互換性のため両方に対応
    const maxResults = body.max_results || 50;

    const result = await pollGmail(lineUserId, maxResults);

    return c.json({
      status: 'ok',
      summary: result.summary,
      details: result.details,
      processing_time_ms: result.processingTimeMs
    });
  } catch (error: any) {
    console.error('Gmail polling error:', error);
    return c.json(
      {
        status: 'error',
        error: {
          code: 'POLLING_ERROR',
          message: error.message
        }
      },
      500
    );
  }
});

// Chatworkポーリング
pollRoutes.post('/chatwork', verifyServiceKey, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const lineUserId = body.user_id || body.line_user_id; // 後方互換性のため両方に対応

    const result = await pollChatwork(lineUserId);

    return c.json({
      status: 'ok',
      summary: result.summary,
      processing_time_ms: result.processingTimeMs
    });
  } catch (error: any) {
    console.error('Chatwork polling error:', error);
    return c.json(
      {
        status: 'error',
        error: {
          code: 'POLLING_ERROR',
          message: error.message
        }
      },
      500
    );
  }
});

// マルチユーザー対応Gmailポーリング（全アクティブユーザー）
pollRoutes.post('/gmail/all', verifyServiceKey, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const maxResults = body.max_results || 50;

    const result = await pollGmailMultiUser(maxResults);

    return c.json({
      status: 'ok',
      summary: result.summary,
      user_details: result.userDetails,
      processing_time_ms: result.processingTimeMs
    });
  } catch (error: any) {
    console.error('Multi-user Gmail polling error:', error);
    return c.json(
      {
        status: 'error',
        error: {
          code: 'POLLING_ERROR',
          message: error.message
        }
      },
      500
    );
  }
});
