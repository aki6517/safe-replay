import { Hono } from 'hono';
import Stripe from 'stripe';
import { handleSubscriptionChange } from '../services/billing';

export const stripeWebhook = new Hono();

stripeWebhook.post('/webhook', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !webhookSecret) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const stripe = new Stripe(stripeSecretKey);
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing signature' }, 400);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return c.json({ error: 'Invalid signature' }, 401);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.subscription) {
          await handleSubscriptionChange(session.customer as string, 'active');
          console.log('[Stripe] Checkout completed:', session.customer);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub.customer as string, sub.status);
        console.log('[Stripe] Subscription updated:', sub.customer, sub.status);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub.customer as string, 'canceled');
        console.log('[Stripe] Subscription deleted:', sub.customer);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[Stripe] Payment failed:', invoice.customer);
        // 将来: ユーザーにLINE通知
        break;
      }
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Processing error:', err.message);
    return c.json({ error: 'Processing error' }, 500);
  }

  return c.json({ received: true });
});
