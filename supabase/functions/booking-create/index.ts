import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, log, parseBody, preflight, rateLimit } from '../_shared/http.ts';
import { isPaymentsConfigured } from '../_shared/env.ts';
import { PaymentsNotConfiguredError, idempotencyKey, stripe } from '../_shared/stripe.ts';
import { commissionBpsFor, commissionTiers, splitAmount } from '../_shared/money.ts';
import { entitlementsFor } from '../_shared/entitlements.ts';
import { expandAvailability } from '../_shared/availability.ts';

/**
 * Creates a booking.
 *
 * Nothing about the money or the time comes from the client. The requested slot
 * is re-derived from the teacher's availability here, the price is read from
 * the teacher's current rate, and the commission is computed from configuration
 * — so a modified client can request a slot, and nothing else.
 *
 * The booking is created as `pending_payment`; only the Stripe webhook confirms
 * it. A database exclusion constraint makes double-booking impossible even if
 * two requests arrive in the same millisecond.
 */

const bodySchema = z.object({
  teacherId: z.string().uuid(),
  languageCode: z.string().min(2).max(5),
  /** Epoch milliseconds, UTC. */
  startsAt: z.number().int().positive(),
  durationMinutes: z.number().int().min(15).max(180).default(60),
  /** Use a lesson from a package the learner already owns. */
  packagePurchaseId: z.string().uuid().optional(),
  learnerNotes: z.string().max(1000).optional(),
  focusAreas: z.array(z.string().max(100)).max(10).default([]),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  if (!rateLimit(`booking:${userId}`, 10)) return fail('rate_limited', undefined, origin);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (body.startsAt <= Date.now()) {
    return fail('validation_failed', 'the requested time is in the past', origin);
  }

  // --- teacher ------------------------------------------------------------
  const { data: teacher } = await asUser
    .from('teachers')
    .select(
      'user_id, status, timezone, hourly_rate_cents, trial_rate_cents, currency, lesson_minutes, lessons_taught, commission_override_bps, payout_enabled, stripe_account_id',
    )
    .eq('user_id', body.teacherId)
    .eq('status', 'approved')
    .maybeSingle();

  if (!teacher) return fail('not_found', 'teacher not found or not accepting bookings', origin);
  if (!teacher.payout_enabled || !teacher.stripe_account_id) {
    return fail('payout_account_incomplete', 'this teacher cannot accept bookings yet', origin);
  }

  const { data: language } = await asUser
    .from('languages')
    .select('id, code')
    .eq('code', body.languageCode)
    .maybeSingle();
  if (!language) return fail('not_found', 'language not found', origin);

  // --- re-derive availability server-side ---------------------------------
  const { data: rules } = await asService
    .from('teacher_availability')
    .select('weekday, start_time, end_time, timezone, valid_from, valid_to')
    .eq('teacher_id', teacher.user_id);

  const { data: exceptions } = await asService
    .from('teacher_availability_exceptions')
    .select('date, kind, start_time, end_time')
    .eq('teacher_id', teacher.user_id);

  const { data: existing } = await asService
    .from('bookings')
    .select('starts_at, ends_at')
    .eq('teacher_id', teacher.user_id)
    .in('status', ['pending_payment', 'confirmed', 'in_progress', 'completed'])
    .gte('starts_at', new Date(body.startsAt - 7 * 86_400_000).toISOString())
    .lte('starts_at', new Date(body.startsAt + 7 * 86_400_000).toISOString());

  const { data: bookingConfig } = await asService
    .from('remote_config')
    .select('value')
    .eq('key', 'booking')
    .maybeSingle();

  const settings = (bookingConfig?.value ?? {}) as {
    slotMinutes?: number;
    bufferMinutes?: number;
    leadTimeMinutes?: number;
    maxPerDay?: number | null;
  };

  const slots = expandAvailability({
    rules: rules ?? [],
    exceptions: exceptions ?? [],
    busy: (existing ?? []).map((b) => ({
      startsAt: new Date(b.starts_at).getTime(),
      endsAt: new Date(b.ends_at).getTime(),
    })),
    teacherTimezone: teacher.timezone,
    options: {
      slotMinutes: settings.slotMinutes ?? 30,
      bufferMinutes: settings.bufferMinutes ?? 10,
      leadTimeMinutes: settings.leadTimeMinutes ?? 120,
      maxPerDay: settings.maxPerDay ?? null,
      from: body.startsAt - 86_400_000,
      to: body.startsAt + 86_400_000,
    },
  });

  if (!slots.some((slot) => slot.startsAt === body.startsAt)) {
    log('booking_slot_unavailable', { teacherId: teacher.user_id });
    return fail('slot_unavailable', 'that time is no longer available', origin);
  }

  // --- price it, server-side ----------------------------------------------
  const tiers = await commissionTiers(asService);
  const commissionBps =
    teacher.commission_override_bps ?? commissionBpsFor(teacher.lessons_taught, tiers);

  let priceCents: number;
  let packagePurchaseId: string | null = null;

  if (body.packagePurchaseId) {
    const { data: purchase } = await asUser
      .from('package_purchases')
      .select('id, user_id, teacher_id, lessons_total, lessons_used, expires_at')
      .eq('id', body.packagePurchaseId)
      .maybeSingle();

    if (!purchase || purchase.user_id !== userId || purchase.teacher_id !== teacher.user_id) {
      return fail('not_found', 'package not found', origin);
    }
    if (purchase.lessons_used >= purchase.lessons_total) {
      return fail('conflict', 'this package has no lessons left', origin);
    }
    if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
      return fail('conflict', 'this package has expired', origin);
    }
    // Already paid for when the package was bought.
    priceCents = 0;
    packagePurchaseId = purchase.id;
  } else {
    const baseRate = teacher.hourly_rate_cents;
    const proRated = Math.round((baseRate * body.durationMinutes) / 60);
    const entitlements = await entitlementsFor(asService, userId);
    priceCents = proRated - Math.floor((proRated * entitlements.tutorDiscountBps) / 10_000);
  }

  const { netMinor: teacherEarnings } = splitAmount(priceCents, commissionBps);

  // --- create the booking --------------------------------------------------
  const { data: booking, error: bookingError } = await asService
    .from('bookings')
    .insert({
      learner_id: userId,
      teacher_id: teacher.user_id,
      language_id: language.id,
      starts_at: new Date(body.startsAt).toISOString(),
      duration_minutes: body.durationMinutes,
      status: packagePurchaseId ? 'confirmed' : 'pending_payment',
      price_cents: priceCents,
      currency: teacher.currency,
      commission_bps: commissionBps,
      teacher_earnings_cents: teacherEarnings,
      package_purchase_id: packagePurchaseId,
      learner_notes: body.learnerNotes ?? null,
      focus_areas: body.focusAreas,
    })
    .select('id, starts_at, ends_at, status, price_cents, currency')
    .single();

  if (bookingError) {
    // The exclusion constraint fires when another learner won the race.
    if (bookingError.message.includes('bookings_no_teacher_overlap')) {
      return fail('slot_unavailable', 'someone else just booked that time', origin);
    }
    log('booking_insert_failed', { message: bookingError.message.slice(0, 120) });
    return fail('unknown', 'could not create the booking', origin);
  }

  // A package lesson is already paid for.
  if (packagePurchaseId) {
    const { data: purchase } = await asService
      .from('package_purchases')
      .select('lessons_used')
      .eq('id', packagePurchaseId)
      .single();
    await asService
      .from('package_purchases')
      .update({ lessons_used: (purchase?.lessons_used ?? 0) + 1 })
      .eq('id', packagePurchaseId);

    return json({ booking, requiresPayment: false }, {}, origin);
  }

  // --- payment intent ------------------------------------------------------
  if (!isPaymentsConfigured()) {
    // Do not leave a phantom reservation behind when payment cannot proceed.
    await asService.from('bookings').delete().eq('id', booking.id);
    return fail('payments_not_configured', 'payments are not configured in this environment', origin);
  }

  try {
    const applicationFee = priceCents - teacherEarnings;
    const intent = await stripe().paymentIntents.create(
      {
        amount: priceCents,
        currency: teacher.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        application_fee_amount: applicationFee,
        transfer_data: { destination: teacher.stripe_account_id! },
        metadata: {
          booking_id: booking.id,
          learner_id: userId,
          teacher_id: teacher.user_id,
          commission_bps: String(commissionBps),
        },
      },
      { idempotencyKey: idempotencyKey('booking', booking.id) },
    );

    await asService.from('payments').insert({
      user_id: userId,
      kind: 'booking',
      amount_cents: priceCents,
      currency: teacher.currency,
      status: 'requires_payment',
      provider: 'stripe',
      provider_payment_intent: intent.id,
      application_fee_cents: applicationFee,
      teacher_id: teacher.user_id,
      booking_id: booking.id,
    });

    return json(
      {
        booking,
        requiresPayment: true,
        clientSecret: intent.client_secret,
        // Shown before the learner pays, so the cancellation terms are never a surprise.
        cancellationPolicyKey: 'booking.cancel.policySummary',
      },
      {},
      origin,
    );
  } catch (error) {
    await asService.from('bookings').delete().eq('id', booking.id);
    if (error instanceof PaymentsNotConfiguredError) {
      return fail('payments_not_configured', undefined, origin);
    }
    log('stripe_intent_failed', { message: String(error).slice(0, 120) });
    return fail('payment_failed', 'could not start the payment', origin);
  }
});
