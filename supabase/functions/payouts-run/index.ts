import { serviceClient } from '../_shared/auth.ts';
import { json, log, preflight } from '../_shared/http.ts';
import { isPaymentsConfigured } from '../_shared/env.ts';
import { idempotencyKey, stripe } from '../_shared/stripe.ts';

/**
 * Moves completed-lesson earnings from pending to available, and pays out.
 *
 * Run on a schedule (see docs/SETUP.md). The hold period exists so a dispute
 * can be resolved before money leaves the platform, and a booking that is
 * disputed or refunded never reaches the available balance at all.
 */

const HOLD_HOURS_DEFAULT = 24;
const MINIMUM_PAYOUT_CENTS = 1000;

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;

  // Scheduled invocation only: the caller must present the service role key.
  const authHeader = request.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ code: 'forbidden' }), { status: 403 });
  }

  if (!isPaymentsConfigured()) {
    return new Response(JSON.stringify({ code: 'payments_not_configured' }), { status: 503 });
  }

  const db = serviceClient();

  const { data: bookingConfig } = await db
    .from('remote_config')
    .select('value')
    .eq('key', 'booking')
    .maybeSingle();
  const holdHours = (bookingConfig?.value as { payoutHoldHours?: number } | undefined)?.payoutHoldHours ?? HOLD_HOURS_DEFAULT;
  const cutoff = new Date(Date.now() - holdHours * 3_600_000).toISOString();

  // --- 1. release held earnings -------------------------------------------
  const { data: releasable } = await db
    .from('bookings')
    .select('id, teacher_id, teacher_earnings_cents, currency')
    .eq('status', 'completed')
    .lte('ends_at', cutoff)
    .is('cancelled_at', null)
    .limit(500);

  const released = new Map<string, { amount: number; currency: string; bookingIds: string[] }>();

  for (const booking of releasable ?? []) {
    // A booking with an open dispute or a refund is not releasable.
    const { count: disputes } = await db
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
      .in('state', ['open', 'reviewing']);
    if ((disputes ?? 0) > 0) continue;

    const { count: refunds } = await db
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
      .in('status', ['pending', 'succeeded']);
    if ((refunds ?? 0) > 0) continue;

    const entry = released.get(booking.teacher_id) ?? {
      amount: 0,
      currency: booking.currency,
      bookingIds: [],
    };
    entry.amount += booking.teacher_earnings_cents;
    entry.bookingIds.push(booking.id);
    released.set(booking.teacher_id, entry);
  }

  for (const [teacherId, entry] of released) {
    const { data: balance } = await db
      .from('teacher_balances')
      .select('pending_cents, available_cents, lifetime_cents')
      .eq('teacher_id', teacherId)
      .maybeSingle();
    if (!balance) continue;

    const move = Math.min(entry.amount, balance.pending_cents);
    await db
      .from('teacher_balances')
      .update({
        pending_cents: balance.pending_cents - move,
        available_cents: balance.available_cents + move,
        lifetime_cents: balance.lifetime_cents + move,
      })
      .eq('teacher_id', teacherId);
  }

  // --- 2. pay out ----------------------------------------------------------
  const { data: payable } = await db
    .from('teacher_balances')
    .select('teacher_id, available_cents, currency')
    .gte('available_cents', MINIMUM_PAYOUT_CENTS)
    .limit(200);

  let paidCount = 0;
  let failedCount = 0;

  for (const balance of payable ?? []) {
    const { data: teacher } = await db
      .from('teachers')
      .select('stripe_account_id, payout_enabled')
      .eq('user_id', balance.teacher_id)
      .maybeSingle();

    if (!teacher?.stripe_account_id || !teacher.payout_enabled) continue;

    const { data: payout } = await db
      .from('payouts')
      .insert({
        teacher_id: balance.teacher_id,
        amount_cents: balance.available_cents,
        currency: balance.currency,
        status: 'pending',
        period_end: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single();

    if (!payout) continue;

    try {
      const transfer = await stripe().transfers.create(
        {
          amount: balance.available_cents,
          currency: balance.currency.toLowerCase(),
          destination: teacher.stripe_account_id,
          metadata: { teacher_id: balance.teacher_id, payout_id: payout.id },
        },
        { idempotencyKey: idempotencyKey('payout', payout.id) },
      );

      await db
        .from('payouts')
        .update({ status: 'in_transit', provider_transfer_id: transfer.id })
        .eq('id', payout.id);

      await db
        .from('teacher_balances')
        .update({ available_cents: 0 })
        .eq('teacher_id', balance.teacher_id);

      paidCount += 1;
    } catch (error) {
      await db
        .from('payouts')
        .update({ status: 'failed', failure_reason: String(error).slice(0, 200) })
        .eq('id', payout.id);
      failedCount += 1;
      log('payout_failed', { teacherId: balance.teacher_id });
    }
  }

  log('payouts_run', { released: released.size, paid: paidCount, failed: failedCount });
  return json({ releasedTeachers: released.size, payoutsCreated: paidCount, payoutsFailed: failedCount });
});
