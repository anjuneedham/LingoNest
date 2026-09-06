import { serviceClient } from '../_shared/auth.ts';
import { log } from '../_shared/http.ts';
import { isPaymentsConfigured } from '../_shared/env.ts';
import { verifyWebhook } from '../_shared/stripe.ts';

/**
 * The only place payment state advances.
 *
 * Signature verification is mandatory and unskippable: an unverified request is
 * rejected before anything is read. The client can never tell us it has paid.
 *
 * Deployed with `--no-verify-jwt`, because Stripe does not carry a user token;
 * the signature is the authentication.
 */

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  if (!isPaymentsConfigured()) {
    return new Response(JSON.stringify({ code: 'payments_not_configured' }), { status: 503 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = await verifyWebhook(request, rawBody);
  } catch (error) {
    // A failed signature is a security signal, not a routine error.
    log('webhook_signature_invalid', { message: String(error).slice(0, 120) });
    return new Response('invalid signature', { status: 400 });
  }

  const db = serviceClient();

  try {
    switch (event.type) {
      // --- marketplace ----------------------------------------------------
      case 'payment_intent.succeeded': {
        const intent = event.data.object as { id: string; metadata?: Record<string, string> };
        const bookingId = intent.metadata?.booking_id;

        await db.from('payments').update({ status: 'succeeded', raw: intent }).eq('provider_payment_intent', intent.id);

        if (bookingId) {
          await db.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId).eq('status', 'pending_payment');

          const { data: booking } = await db
            .from('bookings')
            .select('teacher_id, learner_id, teacher_earnings_cents, currency, starts_at')
            .eq('id', bookingId)
            .maybeSingle();

          if (booking) {
            // Earnings are pending until the lesson happens and the hold passes.
            const { data: balance } = await db
              .from('teacher_balances')
              .select('pending_cents, lifetime_cents')
              .eq('teacher_id', booking.teacher_id)
              .maybeSingle();

            if (balance) {
              await db
                .from('teacher_balances')
                .update({ pending_cents: balance.pending_cents + booking.teacher_earnings_cents })
                .eq('teacher_id', booking.teacher_id);
            } else {
              await db.from('teacher_balances').insert({
                teacher_id: booking.teacher_id,
                pending_cents: booking.teacher_earnings_cents,
                currency: booking.currency,
              });
            }

            await db.from('notifications').insert([
              {
                user_id: booking.teacher_id,
                kind: 'booking_confirmed',
                title_key: 'notification.bookingConfirmed.title',
                body_key: 'notification.bookingConfirmed.body',
                params: { bookingId },
                deep_link: `bookings/${bookingId}`,
              },
              {
                user_id: booking.learner_id,
                kind: 'booking_confirmed',
                title_key: 'notification.bookingConfirmed.title',
                body_key: 'notification.bookingConfirmed.body',
                params: { bookingId },
                deep_link: `bookings/${bookingId}`,
              },
            ]);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as { id: string; last_payment_error?: { code?: string }; metadata?: Record<string, string> };
        await db
          .from('payments')
          .update({ status: 'failed', failure_code: intent.last_payment_error?.code ?? null, raw: intent })
          .eq('provider_payment_intent', intent.id);

        // Release the slot rather than holding it for a payment that failed.
        if (intent.metadata?.booking_id) {
          await db
            .from('bookings')
            .update({ status: 'expired' })
            .eq('id', intent.metadata.booking_id)
            .eq('status', 'pending_payment');
        }
        break;
      }

      // --- subscriptions ---------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as {
          id: string;
          subscription?: string;
          client_reference_id?: string;
          metadata?: Record<string, string>;
          amount_total?: number;
          currency?: string;
        };
        const userId = session.client_reference_id ?? session.metadata?.user_id;
        const planCode = session.metadata?.plan_code;

        if (userId && planCode && session.subscription) {
          await db.from('subscriptions').upsert(
            {
              user_id: userId,
              plan_code: planCode,
              status: 'active',
              platform: 'web',
              provider: 'stripe',
              provider_ref: session.subscription,
            },
            { onConflict: 'user_id,provider,provider_ref' },
          );

          await db.from('payments').insert({
            user_id: userId,
            kind: 'subscription',
            amount_cents: session.amount_total ?? 0,
            currency: (session.currency ?? 'usd').toUpperCase(),
            status: 'succeeded',
            provider: 'stripe',
            provider_payment_intent: session.id,
            raw: session,
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as {
          id: string;
          status: string;
          cancel_at_period_end?: boolean;
          current_period_start?: number;
          current_period_end?: number;
        };

        const statusMap: Record<string, string> = {
          active: 'active',
          trialing: 'trialing',
          past_due: 'past_due',
          canceled: 'canceled',
          unpaid: 'past_due',
          incomplete: 'none',
          incomplete_expired: 'expired',
          paused: 'paused',
        };

        await db
          .from('subscriptions')
          .update({
            status: statusMap[subscription.status] ?? 'none',
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            current_period_start: subscription.current_period_start
              ? new Date(subscription.current_period_start * 1000).toISOString()
              : null,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            cancelled_at: event.type === 'customer.subscription.deleted' ? new Date().toISOString() : null,
          })
          .eq('provider_ref', subscription.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { subscription?: string };
        if (invoice.subscription) {
          await db.from('subscriptions').update({ status: 'past_due' }).eq('provider_ref', invoice.subscription);
        }
        break;
      }

      // --- disputes and connected accounts ---------------------------------
      case 'charge.dispute.created': {
        const dispute = event.data.object as { id: string; payment_intent?: string; reason?: string };
        const { data: payment } = await db
          .from('payments')
          .select('id, booking_id, teacher_id')
          .eq('provider_payment_intent', dispute.payment_intent ?? '')
          .maybeSingle();

        if (payment) {
          await db.from('disputes').insert({
            booking_id: payment.booking_id,
            payment_id: payment.id,
            reason: dispute.reason ?? 'unknown',
            state: 'open',
            provider_dispute_id: dispute.id,
          });
          if (payment.booking_id) {
            await db.from('bookings').update({ status: 'disputed' }).eq('id', payment.booking_id);
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as {
          id: string;
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
        };
        await db
          .from('teachers')
          .update({ payout_enabled: Boolean(account.charges_enabled && account.payouts_enabled) })
          .eq('stripe_account_id', account.id);
        break;
      }

      default:
        log('webhook_ignored', { type: event.type });
    }
  } catch (error) {
    // Return 500 so Stripe retries: dropping an event silently loses money.
    log('webhook_handler_failed', { type: event.type, message: String(error).slice(0, 200) });
    return new Response('handler error', { status: 500 });
  }

  log('webhook_handled', { type: event.type });
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
