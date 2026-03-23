/**
 * プラン別レートリミット管理
 * Free: 5件/月、Pro: 無制限
 * Chatwork/Slack連携はProプラン限定
 */
import { getSupabase } from '../db/client';

interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  planType: string;
  currentCount: number;
}

/**
 * ユーザーがメッセージ処理可能かチェック
 * Free: 5件/月、Pro: 無制限
 */
export async function canProcessMessage(userId: string): Promise<PlanCheckResult> {
  const supabase = getSupabase();
  const { data } = await (supabase.from('users') as any)
    .select('plan_type, message_count_month')
    .eq('id', userId)
    .single();

  if (!data) {
    return { allowed: false, reason: 'User not found', planType: 'unknown', currentCount: 0 };
  }

  const planType = data.plan_type || 'free';
  const count = data.message_count_month || 0;

  if (planType === 'pro') {
    return { allowed: true, planType, currentCount: count };
  }

  // Freeプラン: 5件/月
  if (count >= 5) {
    return { allowed: false, reason: 'Free plan limit reached (5/month)', planType, currentCount: count };
  }

  return { allowed: true, planType, currentCount: count };
}

/**
 * メッセージ処理カウントをインクリメント
 */
export async function incrementMessageCount(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { data } = await (supabase.from('users') as any)
    .select('message_count_month')
    .eq('id', userId)
    .single();
  const current = data?.message_count_month || 0;
  await (supabase.from('users') as any)
    .update({ message_count_month: current + 1 })
    .eq('id', userId);
}

/**
 * Chatwork/Slack連携がProプランかチェック
 */
export async function isPro(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await (supabase.from('users') as any)
    .select('plan_type')
    .eq('id', userId)
    .single();
  return data?.plan_type === 'pro';
}
