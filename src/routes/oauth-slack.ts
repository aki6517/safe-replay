import { Hono } from 'hono';
import { getSupabase, isSupabaseAvailable } from '../db/client';
import {
  buildSlackAuthorizeUrl,
  createSlackOAuthState,
  exchangeSlackCodeForTokens,
  getSlackUserDisplayName,
  isSlackOAuthConfigured,
  parseSlackOAuthState
} from '../services/slack';
import { getBaseUrlFromRequest, getLiffWebBaseUrl, joinBaseUrl } from '../utils/base-url';

export const oauthSlackRouter = new Hono();

async function getOrCreateUser(lineUserId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseAvailable()) {
    return null;
  }

  try {
    const searchResult: any = await supabase
      .from('users')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    if (searchResult.data && !searchResult.error) {
      return searchResult.data.id;
    }

    const insertResult: any = await (supabase.from('users') as any).insert({
      line_user_id: lineUserId,
      is_active: true,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select('id').single();

    if (insertResult.error || !insertResult.data) {
      console.error('[Slack OAuth] Failed to create user:', insertResult.error);
      return null;
    }

    return insertResult.data.id;
  } catch (error) {
    console.error('[Slack OAuth] Failed to get or create user:', error);
    return null;
  }
}

oauthSlackRouter.get('/start', async (c) => {
  try {
    const lineUserId = c.req.query('line_user_id') || c.req.query('lineUserId');
    const apiBaseUrl = getBaseUrlFromRequest(c.req.url);
    const webBaseUrl = getLiffWebBaseUrl(c.req.url);
    const liffErrorBaseUrl = joinBaseUrl(webBaseUrl, '/callback/error');

    if (!lineUserId) {
      return c.redirect(`${liffErrorBaseUrl}?reason=missing_line_user_id`);
    }

    if (!isSlackOAuthConfigured()) {
      return c.redirect(`${liffErrorBaseUrl}?reason=slack_oauth_not_configured`);
    }

    const redirectUri = joinBaseUrl(apiBaseUrl, '/api/oauth/slack/callback');
    const state = await createSlackOAuthState(lineUserId);
    return c.redirect(buildSlackAuthorizeUrl(redirectUri, state));
  } catch (error: any) {
    console.error('[Slack OAuth start error]', error);
    const webBaseUrl = getLiffWebBaseUrl(c.req.url);
    const liffErrorBaseUrl = joinBaseUrl(webBaseUrl, '/callback/error');
    return c.redirect(`${liffErrorBaseUrl}?reason=${encodeURIComponent(error.message)}`);
  }
});

oauthSlackRouter.get('/callback', async (c) => {
  const apiBaseUrl = getBaseUrlFromRequest(c.req.url);
  const webBaseUrl = getLiffWebBaseUrl(c.req.url);
  const redirectUri = joinBaseUrl(apiBaseUrl, '/api/oauth/slack/callback');
  const liffSuccessUrl = joinBaseUrl(webBaseUrl, '/callback/success?provider=Slack');
  const liffErrorBaseUrl = joinBaseUrl(webBaseUrl, '/callback/error');

  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      console.error('[Slack OAuth error]', error);
      return c.redirect(`${liffErrorBaseUrl}?reason=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.redirect(`${liffErrorBaseUrl}?reason=missing_params`);
    }

    if (!isSlackOAuthConfigured()) {
      return c.redirect(`${liffErrorBaseUrl}?reason=slack_oauth_not_configured`);
    }

    const parsedState = await parseSlackOAuthState(state);
    const userId = await getOrCreateUser(parsedState.lineUserId);
    if (!userId) {
      return c.redirect(`${liffErrorBaseUrl}?reason=user_not_found`);
    }

    const tokenResponse = await exchangeSlackCodeForTokens(code, redirectUri);
    const slackTeamId = tokenResponse.team?.id;
    const slackTeamName = tokenResponse.team?.name || null;
    const slackUserId = tokenResponse.authed_user?.id;
    const botAccessToken = tokenResponse.access_token;
    const userAccessToken = tokenResponse.authed_user?.access_token;

    if (!slackTeamId || !slackUserId || !botAccessToken || !userAccessToken) {
      return c.redirect(`${liffErrorBaseUrl}?reason=incomplete_token_response`);
    }

    let slackUserName = slackUserId;
    try {
      const fetchedDisplayName = await getSlackUserDisplayName(botAccessToken, slackUserId);
      if (fetchedDisplayName) {
        slackUserName = fetchedDisplayName;
      }
    } catch (profileError) {
      console.warn('[Slack OAuth] Failed to fetch Slack user display name:', profileError);
    }

    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return c.redirect(`${liffErrorBaseUrl}?reason=db_unavailable`);
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await (supabase.from('slack_installations') as any).upsert({
      user_id: userId,
      line_user_id: parsedState.lineUserId,
      slack_team_id: slackTeamId,
      slack_team_name: slackTeamName,
      slack_user_id: slackUserId,
      slack_user_name: slackUserName,
      bot_user_id: tokenResponse.bot_user_id || null,
      bot_access_token: botAccessToken,
      bot_refresh_token: tokenResponse.refresh_token || null,
      bot_token_expires_at: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : null,
      user_access_token: userAccessToken,
      user_refresh_token: tokenResponse.authed_user?.refresh_token || null,
      user_token_expires_at: tokenResponse.authed_user?.expires_in
        ? new Date(Date.now() + tokenResponse.authed_user.expires_in * 1000).toISOString()
        : null,
      scope: tokenResponse.scope || null,
      user_scope: tokenResponse.authed_user?.scope || null,
      is_active: true,
      last_event_at: null,
      last_error: null,
      installed_at: now,
      updated_at: now
    }, {
      onConflict: 'line_user_id,slack_team_id,slack_user_id'
    });

    if (upsertError) {
      console.error('[Slack OAuth save error]', upsertError);
      return c.redirect(`${liffErrorBaseUrl}?reason=save_failed`);
    }

    console.log('[Slack OAuth complete]', {
      lineUserId: parsedState.lineUserId,
      slackTeamId,
      slackUserId
    });

    return c.redirect(liffSuccessUrl);
  } catch (error: any) {
    console.error('[Slack OAuth callback error]', error);
    return c.redirect(`${liffErrorBaseUrl}?reason=${encodeURIComponent(error.message)}`);
  }
});
