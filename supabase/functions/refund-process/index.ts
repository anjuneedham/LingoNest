import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate, requireRole, serviceClient } from '../_shared/auth.ts';
import { fail, json, log, parseBody, preflight } from '../_shared/http.ts';
import { isPaymentsConfigured } from '../_shared/env.ts';
import { idempotencyKey, stripe } from '../_shared/stripe.ts';

/**
 * Executes refunds that `booking-cancel` decided.
 *
 * Kept separate so that money movement is a single, auditable, retryable step:
 * the policy decision is already recorded, and this either succeeds against the
 * provider or leaves the refund row `pending` for another attempt.
 *
 * Admins may also refund directly; every such action is audited by trigger.
 */

const bodySchema = z.object({
  refundId: z.string().uuid().optional(),
  /** Admin path: refund a payment directly. */
  paymentId: z.string().uuid().optional(),
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isPaymentsConfigured()) return fail('payments_not_configured', undefined, origin);

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const isAdmin = await requireRole(auth.context, 'admin');

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const db = serviceClient();

  // --- resolve the refund row ---------------------------------------------
  let refundId = body.refundId ?? null;

  if (!refundId) {
    if (!isAdmin) return fail('forbidden', 'only an admin may refund a payment directly', origin);
    if (!body.paymentId || !body.amountCents) {
      return fail('validation_failed', 'paymentId and amountCents are required', origin);
    }
    const { data: payment } = await db
      .from('payments')
      .select('id, amount_cents, currency, booking_id, status')
      .eq('id', body.paymentId)
      .maybeSingle();
    if (!payment) return fail('not_found', 'payment not found', origin);
    if (payment.status !== 'succeeded') {
      return fail('conflict', 'only a succeeded payment can be refunded', origin);
    }
    if (body.amountCents > payment.amount_cents) {
      return fail('validation_failed', 'refund exceeds the amount paid', origin);
    }

    const { data: created } = await db
      .from('refunds')
      .insert({
        payment_id: payment.id,
        booking_id: payment.booking_id,
        amount_cents: body.amountCents,
        currency: payment.currency,
        reason: body.reason ?? 'admin refund',
        policy_applied: 'admin_override',
        status: 'pending',
        resolved_by: auth.context.userId,
      })
      .select('id')
      .single();
    refundId = created?.id ?? null;
  }

  if (!refundId) return fail('unknown', 'could not create the refund', origin);

  const { data: refund } = await db
    .from('refunds')
    .select('id, payment_id, amount_cents, status, teacher_payout_cents, booking_id')
    .eq('id', refundId)
    .maybeSingle();
  if (!refund) return fail('not_found', 'refund not found', origin);
  if (refund.status === 'succeeded') {
    return json({ alreadyProcessed: true, refundId }, {}, origin);
  }

  // Authorisation: the learner who paid, or an admin.
  const { data: payment } = await db
    .from('payments')
    .select('id, user_id, provider_payment_intent, amount_cents, teacher_id')
    .eq('id', refund.payment_id)
    .single();

  if (!isAdmin && payment.user_id !== auth.context.userId) {
    return fail('forbidden', undefined, origin);
  }
  if (!payment.provider_payment_intent) {
    return fail('conflict', 'this payment has no provider reference', origin);
  }

  // --- execute -------------------------------------------------------------
  try {
    const created = await stripe().refunds.create(
      {
        payment_intent: payment.provider_payment_intent,
        amount: refund.amount_cents,
        // Claw back the platform fee proportionally, and reverse the transfer
        // unless the teacher is still owed compensation under the policy.
        refund_application_fee: true,
        reverse_transfer: refund.teacher_payout_cents === 0,
      },
      { idempotencyKey: idempotencyKey('refund', refund.id) },
    );

    await db
      .from('refunds')
      .update({ status: 'succeeded', provider_refund_id: created.id })
      .eq('id', refund.id);

    const fullyRefunded = refund.amount_cents >= payment.amount_cents;
    await db
      .from('payments')
      .update({ status: fullyRefunded ? 'refunded' : 'partially_refunded' })
      .eq('id', payment.id);

    // Adjust the teacher's pending balance for what they no longer earn.
    if (payment.teacher_id && refund.teacher_payout_cents === 0) {
      const { data: balance } = await db
        .from('teacher_balances')
        .select('pending_cents')
        .eq('teacher_id', payment.teacher_id)
        .maybeSingle();
      if (balance) {
        const { data: booking } = await db
          .from('bookings')
          .select('teacher_earnings_cents')
          .eq('id', refund.booking_id ?? '')
          .maybeSingle();
        const reverse = booking?.teacher_earnings_cents ?? 0;
        await db
          .from('teacher_balances')
          .update({ pending_cents: Math.max(0, balance.pending_cents - reverse) })
          .eq('teacher_id', payment.teacher_id);
      }
    }

    log('refund_succeeded', { refundId: refund.id, amount: refund.amount_cents });
    return json({ refunded: true, refundId: refund.id, amountCents: refund.amount_cents }, {}, origin);
  } catch (error) {
    await db.from('refunds').update({ status: 'failed' }).eq('id', refund.id);
    log('refund_failed', { refundId: refund.id, message: String(error).slice(0, 120) });
    return fail('payment_failed', 'the refund could not be processed', origin);
  }
});
