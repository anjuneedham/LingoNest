import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, parseBody, preflight } from '../_shared/http.ts';
import { refundOutcome, refundPolicy } from '../_shared/money.ts';

/**
 * Cancels a booking and computes the refund.
 *
 * The outcome is decided by policy from configuration, never by whoever is
 * cancelling. The learner sees the same numbers on the confirmation screen
 * before they confirm, because both call the same rules.
 *
 * This function decides and records; `refund-process` moves the money.
 */

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  /** Preview the outcome without cancelling. */
  dryRun: z.boolean().default(false),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: booking } = await asUser
    .from('bookings')
    .select('id, learner_id, teacher_id, starts_at, status, price_cents, currency, teacher_earnings_cents, package_purchase_id')
    .eq('id', body.bookingId)
    .maybeSingle();

  if (!booking) return fail('not_found', 'booking not found', origin);

  const isLearner = booking.learner_id === userId;
  const isTeacher = booking.teacher_id === userId;
  if (!isLearner && !isTeacher) return fail('forbidden', undefined, origin);

  if (!['pending_payment', 'confirmed'].includes(booking.status)) {
    return fail('booking_not_cancellable', `a ${booking.status} booking cannot be cancelled`, origin);
  }

  const startsAt = new Date(booking.starts_at).getTime();
  const hoursBefore = (startsAt - Date.now()) / 3_600_000;
  if (hoursBefore < 0) {
    return fail('booking_not_cancellable', 'the lesson has already started', origin);
  }

  const policy = await refundPolicy(asService);
  const outcome = refundOutcome({
    priceMinor: booking.price_cents,
    teacherEarningsMinor: booking.teacher_earnings_cents,
    hoursBefore,
    reason: isTeacher ? 'teacher_cancelled' : 'learner_cancelled',
    policy,
  });

  if (body.dryRun) {
    return json({ preview: true, hoursBefore: Math.round(hoursBefore * 10) / 10, outcome }, {}, origin);
  }

  const { error } = await asService
    .from('bookings')
    .update({
      status: isTeacher ? 'cancelled_by_teacher' : 'cancelled_by_learner',
      cancellation_reason: body.reason ?? null,
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', booking.id);

  if (error) return fail('unknown', 'could not cancel the booking', origin);

  // A package lesson goes back into the package rather than being refunded.
  if (booking.package_purchase_id && outcome.refundMinor > 0) {
    const { data: purchase } = await asService
      .from('package_purchases')
      .select('lessons_used')
      .eq('id', booking.package_purchase_id)
      .single();
    await asService
      .from('package_purchases')
      .update({ lessons_used: Math.max(0, (purchase?.lessons_used ?? 1) - 1) })
      .eq('id', booking.package_purchase_id);
  } else if (outcome.refundMinor > 0) {
    // Recorded here, executed by refund-process against the provider.
    const { data: payment } = await asService
      .from('payments')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('status', 'succeeded')
      .maybeSingle();

    if (payment) {
      await asService.from('refunds').insert({
        payment_id: payment.id,
        booking_id: booking.id,
        amount_cents: outcome.refundMinor,
        currency: booking.currency,
        reason: body.reason ?? (isTeacher ? 'teacher cancelled' : 'learner cancelled'),
        policy_applied: outcome.policyApplied,
        teacher_payout_cents: outcome.teacherPayoutMinor,
        learner_credit_cents: outcome.learnerCreditMinor,
        status: 'pending',
      });
    }
  }

  // Goodwill credit when the teacher cancelled on the learner.
  if (outcome.learnerCreditMinor > 0) {
    await asService.from('learner_credits').insert({
      user_id: booking.learner_id,
      amount_cents: outcome.learnerCreditMinor,
      remaining_cents: outcome.learnerCreditMinor,
      currency: booking.currency,
      reason: 'teacher cancelled a booked lesson',
      expires_at: new Date(Date.now() + 180 * 86_400_000).toISOString(),
    });
  }

  await asService.from('notifications').insert({
    user_id: isTeacher ? booking.learner_id : booking.teacher_id,
    kind: 'booking_cancelled',
    title_key: 'notification.bookingCancelled.title',
    body_key: 'notification.bookingCancelled.body',
    params: { bookingId: booking.id, byRole: isTeacher ? 'teacher' : 'learner' },
    deep_link: `bookings/${booking.id}`,
  });

  return json({ cancelled: true, outcome }, {}, origin);
});
