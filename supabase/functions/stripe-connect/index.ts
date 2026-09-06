import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, parseBody, preflight } from '../_shared/http.ts';
import { isPaymentsConfigured } from '../_shared/env.ts';
import { stripe } from '../_shared/stripe.ts';

/**
 * Teacher payout onboarding via Stripe Connect Express.
 *
 * A teacher cannot be booked until `payout_enabled` is true, and that flag is
 * set only by the `account.updated` webhook — never here, and never by the
 * teacher. "Approved" and "able to be paid" are deliberately separate states.
 */

const bodySchema = z.object({
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
  country: z.string().length(2).default('US'),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isPaymentsConfigured()) return fail('payments_not_configured', undefined, origin);

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: teacher } = await asUser
    .from('teachers')
    .select('user_id, status, stripe_account_id, payout_enabled, currency')
    .eq('user_id', userId)
    .maybeSingle();

  if (!teacher) return fail('not_found', 'you do not have a teacher profile', origin);
  if (teacher.status !== 'approved') {
    return fail('forbidden', 'your application must be approved before setting up payouts', origin);
  }

  const { data: profile } = await asUser
    .from('profiles')
    .select('country')
    .eq('id', userId)
    .maybeSingle();

  try {
    let accountId = teacher.stripe_account_id;

    if (!accountId) {
      const account = await stripe().accounts.create({
        type: 'express',
        country: profile?.country ?? body.country,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: 'individual',
        metadata: { teacher_id: userId },
      });
      accountId = account.id;
      await asService.from('teachers').update({ stripe_account_id: accountId }).eq('user_id', userId);
    }

    const link = await stripe().accountLinks.create({
      account: accountId,
      refresh_url: body.refreshUrl,
      return_url: body.returnUrl,
      type: 'account_onboarding',
    });

    const account = await stripe().accounts.retrieve(accountId);

    return json(
      {
        onboardingUrl: link.url,
        accountId,
        // Reported from the provider so the dashboard can say exactly what is
        // still outstanding, rather than a vague "pending".
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirementsDue: account.requirements?.currently_due ?? [],
      },
      {},
      origin,
    );
  } catch (error) {
    return fail('payment_failed', `could not start payout onboarding: ${String(error).slice(0, 120)}`, origin);
  }
});
