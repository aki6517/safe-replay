/**
 * ユーザーAPI（LIFF用）
 * オンボーディング時のユーザー登録・設定を管理
 */
import { Hono } from 'hono';
import { getSupabase, isSupabaseAvailable } from '../db/client';

export const userApiRouter = new Hono();

/**
 * ユーザー状態を取得（または新規作成）
 */
userApiRouter.post('/status', async (c) => {
  try {
    const { lineUserId } = await c.req.json();
    
    if (!lineUserId) {
      return c.json({ error: 'lineUserId is required' }, 400);
    }

    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return c.json({ error: 'Database not available' }, 503);
    }

    // 既存ユーザーを検索
    let { data: user } = await (supabase.from('users') as any)
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    // 新規ユーザーの場合は作成
    if (!user) {
      const { data: newUser, error: createError } = await (supabase.from('users') as any)
        .insert({
          line_user_id: lineUserId,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('[ユーザー作成エラー]', createError);
        return c.json({ error: 'Failed to create user' }, 500);
      }

      user = newUser;
    }

    // 連携状態を返す
    return c.json({
      userId: user?.id,
      gmailConnected: !!user?.gmail_refresh_token,
      chatworkConnected: !!user?.chatwork_api_token,
      status: user?.status
    });

  } catch (error: any) {
    console.error('[ユーザー状態取得エラー]', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Chatwork APIトークンを保存
 */
userApiRouter.post('/chatwork', async (c) => {
  try {
    const { lineUserId, chatworkToken } = await c.req.json();
    
    if (!lineUserId || !chatworkToken) {
      return c.json({ error: 'lineUserId and chatworkToken are required' }, 400);
    }

    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return c.json({ error: 'Database not available' }, 503);
    }

    // トークンを更新
    const { error } = await (supabase.from('users') as any)
      .update({ 
        chatwork_api_token: chatworkToken,
        updated_at: new Date().toISOString()
      })
      .eq('line_user_id', lineUserId);

    if (error) {
      console.error('[Chatworkトークン保存エラー]', error);
      return c.json({ error: 'Failed to save token' }, 500);
    }

    console.log('[Chatworkトークン保存完了]', { lineUserId });
    return c.json({ success: true });

  } catch (error: any) {
    console.error('[Chatworkトークン保存エラー]', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * セットアップ完了
 */
userApiRouter.post('/complete', async (c) => {
  try {
    const { lineUserId } = await c.req.json();
    
    if (!lineUserId) {
      return c.json({ error: 'lineUserId is required' }, 400);
    }

    const supabase = getSupabase();
    if (!supabase || !isSupabaseAvailable()) {
      return c.json({ error: 'Database not available' }, 503);
    }

    // ユーザーを取得
    const { data: user } = await (supabase.from('users') as any)
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Gmail連携が必須
    if (!user.gmail_refresh_token) {
      return c.json({ error: 'Gmail connection required' }, 400);
    }

    // ステータスを更新
    const { error } = await (supabase.from('users') as any)
      .update({ 
        status: 'active',
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('line_user_id', lineUserId);

    if (error) {
      console.error('[セットアップ完了エラー]', error);
      return c.json({ error: 'Failed to complete setup' }, 500);
    }

    console.log('[セットアップ完了]', { lineUserId });
    return c.json({ success: true });

  } catch (error: any) {
    console.error('[セットアップ完了エラー]', error);
    return c.json({ error: error.message }, 500);
  }
});

