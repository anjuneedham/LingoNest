import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { json, parseBody, preflight, rateLimit, fail } from '../_shared/http.ts';

/**
 * Analytics ingest.
 *
 * Two jobs beyond writing rows: reject any payload carrying personal data, and
 * honour the learner's analytics consent. Events arrive batched from the device
 * because the buffer is offline-safe.
 */

/** Never accepted in a payload, whatever the client thinks it is sending. */
const FORBIDDEN_KEYS = new Set([
  'email',
  'phone',
  'password',
  'name',
  'fullName',
  'address',
  'latitude',
  'longitude',
  'ip',
  'deviceId',
  'advertisingId',
  'text',
  'transcript',
  'message',
  'answer',
  'essay',
]);

const KNOWN_EVENTS = new Set([
  'signup_completed',
  'onboarding_completed',
  'language_selected',
  'placement_started',
  'placement_completed',
  'placement_skipped',
  'assessment_started',
  'assessment_completed',
  'lesson_started',
  'lesson_completed',
  'lesson_abandoned',
  'activity_completed',
  'level_completed',
  'checkpoint_completed',
  'review_session_completed',
  'ai_practice_started',
  'ai_practice_completed',
  'ai_limit_reached',
  'teacher_search',
  'teacher_view',
  'booking_started',
  'booking_completed',
  'booking_cancelled',
  'lesson_attended',
  'assignment_completed',
  'paywall_viewed',
  'subscription_started',
  'subscription_cancelled',
  'review_submitted',
  'referral_created',
  'referral_converted',
  'teacher_application_started',
  'teacher_application_submitted',
  'notification_opened',
  'share_created',
]);

const bodySchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        props: z.record(z.string(), z.unknown()).default({}),
        ts: z.number().int().positive(),
        sessionId: z.string().max(64),
      }),
    )
    .min(1)
    .max(100),
  appVersion: z.string().max(32),
  platform: z.enum(['ios', 'android', 'web']),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  if (!rateLimit(`analytics:${userId}`, 60)) return fail('rate_limited', undefined, origin);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: profile } = await asUser
    .from('profiles')
    .select('analytics_consent')
    .eq('id', userId)
    .maybeSingle();

  // Consent withdrawn: accept the request so the client can clear its buffer,
  // but keep nothing.
  if (profile && profile.analytics_consent === false) {
    return json({ accepted: 0, reason: 'analytics_consent_withheld' }, {}, origin);
  }

  const rejected: string[] = [];
  const rows = [];

  for (const event of body.events) {
    if (!KNOWN_EVENTS.has(event.name)) {
      rejected.push(`unknown_event:${event.name}`);
      continue;
    }
    const offending = Object.keys(event.props).filter((key) => FORBIDDEN_KEYS.has(key));
    if (offending.length > 0) {
      rejected.push(`pii:${event.name}:${offending.join(',')}`);
      continue;
    }
    rows.push({
      user_id: userId,
      name: event.name,
      props: event.props,
      session_id: event.sessionId,
      app_version: body.appVersion,
      platform: body.platform,
      ts: new Date(event.ts).toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error } = await asService.from('events').insert(rows).select('id');
    if (error) {
      // The analytics schema is not exposed through PostgREST by default, so
      // fall back to the RPC wrapper when direct insert is unavailable.
      await asService.rpc('ingest_analytics_events', { p_events: rows });
    }
  }

  return json({ accepted: rows.length, rejected }, {}, origin);
});
