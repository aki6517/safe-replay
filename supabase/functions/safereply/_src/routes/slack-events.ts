import { Hono } from 'hono';
import { processSlackEventEnvelope } from '../services/slack-message-processor.ts';
import {
  shouldProcessSlackEvent,
  verifySlackRequestSignature
} from '../services/slack.ts';
import type { SlackEventEnvelope } from '../types/slack.ts';

export const slackEventsRouter = new Hono();

slackEventsRouter.post('/events', async (c) => {
  const rawBody = await c.req.raw.text();
  const timestamp = c.req.header('X-Slack-Request-Timestamp') || '';
  const signature = c.req.header('X-Slack-Signature') || '';

  if (!(await verifySlackRequestSignature(rawBody, timestamp, signature))) {
    console.error('[Slack events] Invalid signature');
    return c.text('Invalid signature', 401);
  }

  let payload: SlackEventEnvelope;
  try {
    payload = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch (error) {
    console.error('[Slack events] Invalid JSON payload', error);
    return c.text('Invalid payload', 400);
  }

  if (payload.type === 'url_verification' && payload.challenge) {
    return c.text(payload.challenge);
  }

  if (payload.type !== 'event_callback' || !payload.event) {
    return c.json({ ok: true });
  }

  if (!shouldProcessSlackEvent(payload.event)) {
    return c.json({ ok: true });
  }

  const task = processSlackEventEnvelope(payload);
  const executionCtx = (c as any).executionCtx;
  if (executionCtx && typeof executionCtx.waitUntil === 'function') {
    executionCtx.waitUntil(task);
  } else {
    void task.catch((error) => {
      console.error('[Slack events] Background processing failed', error);
    });
  }

  return c.json({ ok: true });
});
