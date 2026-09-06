import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, parseBody, preflight, rateLimit } from '../_shared/http.ts';
import { config, isPaymentsConfigured } from '../_shared/env.ts';
import { idempotencyKey, stripe } from '../_shared/stripe.ts';

/**
 * Starts a subscription checkout (web).
 *
 * The price is read from `subscription_plans`, never from the request: a client
 * can choose a plan and an interval, and nothing else. On iOS and Android the
 * app uses store billing instead and `iap-verify` writes the same rows — the
 * rest of the system asks "what is this user entitled to?", not "where did they
 * buy it?".
 */

const bodySchema = z.object({
  planCode: z.enum(['premium', 'premium_plus']),
  interval: z.enum(['month', 'year']),
  currency: z.string().length(3).default('USD'),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  promotionCode: z.string().max(40).optional(),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isPaymentsConfigured()) {
    return fail('payments_not_configured', 'subscriptions are not configured in this environment', origin);
  }

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  if (!rateLimit(`checkout:${userId}`, 10)) return fail('rate_limited', undefined, origin);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: existing } = await asService
    .from('subscriptions')
    .select('id, plan_code, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (existing && existing.plan_code === body.planCode) {
    return fail('conflict', 'you are already subscribed to this plan', origin);
  }

  const { data: plan } = await asUser
    .from('subscription_plans')
    .select('code, prices, trial_days, stripe_price_ids, active')
    .eq('code', body.planCode)
    .eq('active', true)
    .maybeSingle();

  if (!plan) return fail('not_found', 'plan not found', origin);

  // Prefer a configured Stripe price id; fall back to an inline price built
  // from the same table the app renders the paywall from.
  const priceIds = (plan.stripe_price_ids ?? {}) as Record<string, Record<string, string>>;
  const configuredPriceId = priceIds[body.currency]?.[body.interval] ?? priceIds.USD?.[body.interval];

  const prices = (plan.prices ?? {}) as Record<string, Record<string, number>>;
  const amount = prices[body.currency]?.[body.interval] ?? prices.USD?.[body.interval];
  const currency = prices[body.currency]?.[body.interval] ? body.currency : 'USD';

  if (!configuredPriceId && amount === undefined) {
    return fail('not_found', 'this plan has no price in that currency', origin);
  }

  const { data: profile } = await asUser
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'subscription',
        client_reference_id: userId,
        success_url: body.successUrl,
        cancel_url: body.cancelUrl,
        allow_promotion_codes: true,
        line_items: [
          configuredPriceId
            ? { price: configuredPriceId, quantity: 1 }
            : {
                quantity: 1,
                price_data: {
                  currency: currency.toLowerCase(),
                  unit_amount: amount!,
                  recurring: { interval: body.interval },
                  product_data: { name: `${plan.code} subscription` },
                },
              },
        ],
        subscription_data: {
          trial_period_days: plan.trial_days > 0 ? plan.trial_days : undefined,
          metadata: { user_id: userId, plan_code: plan.code },
        },
        metadata: {
          user_id: userId,
          plan_code: plan.code,
          display_name: profile?.display_name ?? '',
        },
      },
      { idempotencyKey: idempotencyKey('checkout', userId, plan.code, body.interval, Date.now()) },
    );

    return json({ url: session.url, sessionId: session.id }, {}, origin);
  } catch (error) {
    return fail('payment_failed', `could not start checkout: ${String(error).slice(0, 120)}`, origin);
  }
});
