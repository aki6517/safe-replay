import Stripe from 'stripe';
import { getSupabase } from '../db/client';

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
}

/**
 * Stripe Checkout セッションを作成（LIFFから呼ばれる）
 */
export async function createCheckoutSession(lineUserId: string): Promise<string | null> {
  const stripe = getStripeClient();
  const supabase = getSupabase();

  // ユーザー取得
  const { data: user } = await (supabase.from('users') as any)
    .select('id, stripe_customer_id')
    .eq('line_user_id', lineUserId)
    .single();
  if (!user) return null;

  // Stripe Customer作成（なければ）
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { line_user_id: lineUserId, user_id: user.id }
    });
    customerId = customer.id;
    await (supabase.from('users') as any)
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) throw new Error('STRIPE_PRO_PRICE_ID not configured');

  const baseUrl = process.env.BASE_URL || process.env.LIFF_WEB_BASE_URL || '';
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/liff/callback/success?provider=Stripe`,
    cancel_url: `${baseUrl}/liff`,
    metadata: { line_user_id: lineUserId }
  });

  return session.url;
}

/**
 * サブスクリプション更新をDBに反映
 */
export async function handleSubscriptionChange(
  stripeCustomerId: string,
  status: string
): Promise<void> {
  const supabase = getSupabase();
  const planType = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
  await (supabase.from('users') as any)
    .update({
      subscription_status: status,
      plan_type: planType,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', stripeCustomerId);
}
