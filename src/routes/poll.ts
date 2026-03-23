/**
 * ポーリングAPI（Gmail/Chatwork）
 */
import { Hono } from 'hono';
import { pollGmail } from '../services/poller/gmail';
import { pollChatwork } from '../services/poller/chatwork';
import { pollGmailMultiUser } from '../services/poller/gmail-multi';
import { getExpiredSnoozes } from '../services/snooze';
import { sendLineNotification } from '../services/notifier';
import { getSupabase } from '../db/client';

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

// スヌーズリマインドチェック（5分間隔で呼ばれる想定）
pollRoutes.post('/snooze-check', verifyServiceKey, async (c) => {
  const startTime = Date.now();
  const results: { messageId: string; status: 'notified' | 'error' }[] = [];

  try {
    const expiredSnoozes = await getExpiredSnoozes();
    console.log('[スヌーズチェック] 期限切れ件数:', expiredSnoozes.length);

    const supabase = getSupabase();

    for (const message of expiredSnoozes) {
      try {
        // user_id (DB UUID) から line_user_id を取得
        const { data: userData, error: userError } = await (supabase.from('users') as any)
          .select('line_user_id')
          .eq('id', message.user_id)
          .single();

        if (userError || !userData?.line_user_id) {
          console.error('[スヌーズチェック] ユーザー取得失敗:', { messageId: message.id, userError });
          results.push({ messageId: message.id, status: 'error' });
          continue;
        }

        const lineUserId: string = userData.line_user_id;

        // 元の通知と同じ形式で再通知
        const notified = await sendLineNotification(
          lineUserId,
          message.id,
          message.triage_type || 'A',
          {
            subject: message.subject || undefined,
            body: message.body_plain || '',
            sender: message.sender_name || '（不明）',
            source: message.source_type || '（不明）'
          },
          message.draft_reply || undefined
        );

        if (notified) {
          // status を pending に戻し、snooze_until をリセット
          await (supabase.from('messages') as any)
            .update({ status: 'pending', snooze_until: null })
            .eq('id', message.id);
          results.push({ messageId: message.id, status: 'notified' });
          console.log('[スヌーズチェック] 再通知成功:', { messageId: message.id, lineUserId });
        } else {
          results.push({ messageId: message.id, status: 'error' });
          console.error('[スヌーズチェック] 再通知失敗:', { messageId: message.id });
        }
      } catch (itemError: any) {
        console.error('[スヌーズチェック] メッセージ処理エラー:', { messageId: message.id, error: itemError.message });
        results.push({ messageId: message.id, status: 'error' });
      }
    }

    return c.json({
      status: 'ok',
      checked: expiredSnoozes.length,
      notified: results.filter((r) => r.status === 'notified').length,
      errors: results.filter((r) => r.status === 'error').length,
      processing_time_ms: Date.now() - startTime
    });
  } catch (error: any) {
    console.error('[スヌーズチェック] エラー:', error);
    return c.json(
      {
        status: 'error',
        error: {
          code: 'SNOOZE_CHECK_ERROR',
          message: error.message
        }
      },
      500
    );
  }
});
