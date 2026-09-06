import { z } from 'https://esm.sh/zod@3.23.8';

/** CORS for the mobile app and the web admin. */
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-app-version';

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

/** Error codes the client maps to a specific screen state. */
export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'rate_limited'
  | 'conflict'
  | 'ai_not_configured'
  | 'ai_unavailable'
  | 'ai_limit_reached'
  | 'payments_not_configured'
  | 'payment_failed'
  | 'payout_account_incomplete'
  | 'subscription_required'
  | 'video_not_configured'
  | 'slot_unavailable'
  | 'booking_not_cancellable'
  | 'unknown';

const STATUS_FOR: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  rate_limited: 429,
  conflict: 409,
  ai_not_configured: 503,
  ai_unavailable: 503,
  ai_limit_reached: 402,
  payments_not_configured: 503,
  payment_failed: 402,
  payout_account_incomplete: 409,
  subscription_required: 402,
  video_not_configured: 503,
  slot_unavailable: 409,
  booking_not_cancellable: 409,
  unknown: 500,
};

export function json(body: unknown, init: ResponseInit = {}, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...(init.headers ?? {}),
    },
  });
}

export function fail(code: ErrorCode, detail?: string, origin: string | null = null): Response {
  return json({ code, detail }, { status: STATUS_FOR[code] }, origin);
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders(request.headers.get('origin')) });
}

/** Parse and validate a request body, returning a typed value or a 422. */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail('validation_failed', 'body is not valid JSON') };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      response: fail('validation_failed', first ? `${first.path.join('.')}: ${first.message}` : 'invalid body'),
    };
  }
  return { ok: true, value: result.data };
}

/**
 * In-memory token bucket, per identity and route.
 *
 * Good enough to stop a single client hammering an expensive endpoint within
 * one instance. It is not a distributed limiter: the durable limits that
 * actually protect spend are the per-plan AI counters in the database, which
 * every AI function checks before calling the model.
 */
const buckets = new Map<string, { tokens: number; refilledAt: number }>();

export function rateLimit(key: string, perMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: perMinute, refilledAt: now };
  const elapsedMinutes = (now - bucket.refilledAt) / 60_000;
  const refilled = Math.min(perMinute, bucket.tokens + elapsedMinutes * perMinute);
  if (refilled < 1) {
    buckets.set(key, { tokens: refilled, refilledAt: now });
    return false;
  }
  buckets.set(key, { tokens: refilled - 1, refilledAt: now });
  return true;
}

/** Structured log line. Never contains learner text, tokens or secrets. */
export function log(event: string, fields: Record<string, string | number | boolean> = {}): void {
  console.log(JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}
