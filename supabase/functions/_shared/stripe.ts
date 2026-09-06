import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { config, isPaymentsConfigured } from './env.ts';

/**
 * Stripe client.
 *
 * The secret key lives only here. Two rules the rest of the code depends on:
 * amounts are always recomputed server-side from database rows before a charge,
 * and payment state is only ever advanced by a signature-verified webhook.
 */

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('STRIPE_SECRET_KEY is not configured');
  }
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!isPaymentsConfigured()) throw new PaymentsNotConfiguredError();
  if (!client) {
    client = new Stripe(config.stripeSecret()!, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return client;
}

/**
 * Verify a webhook signature. Unverified webhooks are rejected — this is the
 * only thing standing between an open endpoint and free subscriptions.
 */
export async function verifyWebhook(request: Request, rawBody: string): Promise<Stripe.Event> {
  const secret = config.stripeWebhookSecret();
  if (!secret) throw new PaymentsNotConfiguredError();

  const signature = request.headers.get('stripe-signature');
  if (!signature) throw new Error('missing stripe-signature header');

  return await stripe().webhooks.constructEventAsync(
    rawBody,
    signature,
    secret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}

/** Idempotency key so a retried request cannot double-charge. */
export function idempotencyKey(...parts: (string | number)[]): string {
  return parts.join(':');
}
