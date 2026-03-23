import { getSupabase, isSupabaseAvailable } from '../db/client.ts';
import { triageMessage } from '../ai/triage.ts';
import { generateDraft } from '../ai/draft.ts';
import { sendLineNotification } from './notifier.ts';
import {
  getSlackInstallationUserId,
  getSlackEventTeamId,
  getSlackEventUserId,
  getSlackUserDisplayName,
  isSlackAppMentionEvent,
  isSlackMessageEvent,
  normalizeSlackMessageText
} from './slack.ts';
import type { SlackAppMentionEvent, SlackEventEnvelope, SlackMessageEvent } from '../types/slack.ts';

type SlackInstallation = {
  id: string;
  user_id: string;
  line_user_id: string;
  slack_team_id: string;
  slack_team_name?: string | null;
  slack_user_id: string;
  slack_user_name?: string | null;
  bot_user_id?: string | null;
  bot_access_token: string;
  is_active?: boolean;
};

function isDuplicateKeyError(error: any): boolean {
  return error?.code === '23505' || /duplicate/i.test(error?.message || '');
}

function getEventSourceLabel(event: SlackMessageEvent | SlackAppMentionEvent): 'dm' | 'mention' {
  return event.type === 'app_mention' ? 'mention' : 'dm';
}

async function getSlackInstallation(teamId: string, slackUserId: string): Promise<SlackInstallation | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    return null;
  }

  const { data, error } = await (supabase.from('slack_installations') as any)
    .select('*')
    .eq('slack_team_id', teamId)
    .eq('slack_user_id', slackUserId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.warn('[Slack event] Installation lookup failed', { teamId, slackUserId, error: error?.message });
    return null;
  }

  return data as SlackInstallation;
}

async function updateSlackInstallationHeartbeat(installationId: string, lastError?: string | null): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    return;
  }

  await (supabase.from('slack_installations') as any)
    .update({
      last_event_at: new Date().toISOString(),
      last_error: lastError || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', installationId);
}

export async function processSlackEventEnvelope(payload: SlackEventEnvelope): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    console.error('[Slack event] Supabase is not available');
    return;
  }

  const teamId = getSlackEventTeamId(payload);
  const event = payload.event;
  const installationSlackUserId = getSlackInstallationUserId(payload);
  const senderSlackUserId = event ? getSlackEventUserId(event) : null;

  if (!teamId || !event || !installationSlackUserId || !senderSlackUserId) {
    console.warn('[Slack event] Missing routing fields', {
      eventId: payload.event_id,
      teamId,
      eventType: event?.type,
      installationSlackUserId,
      senderSlackUserId
    });
    return;
  }

  if (!isSlackMessageEvent(event) && !isSlackAppMentionEvent(event)) {
    console.warn('[Slack event] Unsupported event payload', {
      eventId: payload.event_id,
      eventType: event.type
    });
    return;
  }

  const installation = await getSlackInstallation(teamId, installationSlackUserId);
  if (!installation) {
    return;
  }

  try {
    const rawText = event.text || '';
    const normalizedText = normalizeSlackMessageText(rawText, {
      botUserId: installation.bot_user_id || undefined
    });

    if (!normalizedText) {
      console.log('[Slack event] Empty message body after normalization', {
        eventId: payload.event_id,
        teamId,
        installationSlackUserId,
        senderSlackUserId
      });
      await updateSlackInstallationHeartbeat(installation.id);
      return;
    }

    const sourceMessageId = `${teamId}:${event.channel}:${event.ts}`;
    const threadTs = event.thread_ts || event.ts;
    const receivedAt = new Date(Number(event.ts.split('.')[0]) * 1000).toISOString();
    const sourceLabel = getEventSourceLabel(event as SlackMessageEvent | SlackAppMentionEvent);

    const insertData = {
      user_id: installation.user_id,
      source_type: 'slack' as const,
      source_message_id: sourceMessageId,
      thread_id: threadTs,
      sender_identifier: senderSlackUserId,
      sender_name: senderSlackUserId,
      subject: null,
      body_plain: normalizedText,
      extracted_content: normalizedText,
      received_at: receivedAt,
      status: 'pending' as const,
      metadata: {
        installation_id: installation.id,
        team_id: teamId,
        team_name: installation.slack_team_name || null,
        channel_id: event.channel,
        channel_type: event.type === 'message' ? event.channel_type || 'im' : 'channel',
        thread_ts: threadTs,
        slack_ts: event.ts,
        event_id: payload.event_id || null,
        event_type: event.type,
        source_label: sourceLabel,
        mentioned_app: event.type === 'app_mention'
      } as Record<string, unknown>
    };

    const { data: insertedData, error: insertError } = await (supabase.from('messages') as any)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      if (isDuplicateKeyError(insertError)) {
        console.log('[Slack event] Duplicate message skipped', { sourceMessageId });
        await updateSlackInstallationHeartbeat(installation.id);
        return;
      }

      await updateSlackInstallationHeartbeat(installation.id, insertError.message);
      throw insertError;
    }

    const messageId = insertedData?.id;
    if (!messageId) {
      await updateSlackInstallationHeartbeat(installation.id, 'message_id_not_returned');
      console.error('[Slack event] Insert succeeded without message ID', { sourceMessageId });
      return;
    }

    let senderName = senderSlackUserId;
    try {
      const fetchedDisplayName = await getSlackUserDisplayName(
        installation.bot_access_token,
        senderSlackUserId
      );
      if (fetchedDisplayName) {
        senderName = fetchedDisplayName;
        await (supabase.from('messages') as any).update({
          sender_name: senderName
        }).eq('id', messageId);
      }
    } catch (senderError: any) {
      console.warn('[Slack event] Sender profile lookup failed', {
        messageId,
        senderSlackUserId,
        error: senderError.message
      });
    }

    const triageResult = await triageMessage('', normalizedText);

    await (supabase.from('messages') as any).update({
      triage_type: triageResult.type,
      triage_reason: triageResult.reason,
      priority_score: triageResult.priority_score,
      ai_analysis: {
        confidence: triageResult.confidence,
        details: triageResult.details
      } as Record<string, unknown>
    }).eq('id', messageId);

    let draft: string | undefined;
    if (triageResult.type === 'A' || triageResult.type === 'B') {
      try {
        draft = await generateDraft('', normalizedText, triageResult.type);
        if (draft) {
          await (supabase.from('messages') as any).update({
            draft_reply: draft
          }).eq('id', messageId);
        }
      } catch (draftError: any) {
        console.warn('[Slack event] Draft generation failed', {
          messageId,
          error: draftError.message
        });
      }
    }

    let softenedBody = normalizedText;
    try {
      const { softenMessage } = await import('../ai/soften.ts');
      softenedBody = await softenMessage(
        '',
        normalizedText,
        senderName,
        triageResult.type,
        draft,
        undefined
      );
    } catch (softenError: any) {
      console.warn('[Slack event] Message softening failed', {
        messageId,
        error: softenError.message
      });
    }

    await sendLineNotification(
      installation.line_user_id,
      messageId,
      triageResult.type,
      {
        subject: undefined,
        body: softenedBody.substring(0, 800),
        sender: senderName,
        source: 'Slack'
      },
      draft,
      {
        notifyTypeC: true
      }
    );

    await updateSlackInstallationHeartbeat(installation.id);
    console.log('[Slack event] Processed successfully', {
      messageId,
      sourceMessageId,
      triageType: triageResult.type
    });
  } catch (error: any) {
    await updateSlackInstallationHeartbeat(installation.id, error.message);
    console.error('[Slack event] Processing failed', {
      eventId: payload.event_id,
      installationId: installation.id,
      error: error.message
    });
  }
}
