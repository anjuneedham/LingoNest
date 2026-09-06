import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, parseBody, preflight, rateLimit } from '../_shared/http.ts';
import { isAiConfigured } from '../_shared/env.ts';
import { AiNotConfiguredError, AiUnavailableError, complete, costMicros, extractJson } from '../_shared/anthropic.ts';
import { entitlementsFor, recordAiUsage } from '../_shared/entitlements.ts';
import { coachSystemPrompt, type Cefr } from '../_shared/prompts.ts';

/**
 * The AI study coach (brief §44).
 *
 * Premium Plus only. It reads the learner's actual weaknesses from the database
 * and proposes a session that fits the time they have — "you keep using ser
 * where Spanish needs estar; five minutes on that" rather than "practise more".
 */

const bodySchema = z.object({
  languageCode: z.string().min(2).max(5),
  minutesAvailable: z.number().int().min(1).max(180).default(10),
});

const planSchema = z.object({
  message: z.string().min(1),
  plan: z
    .array(
      z.object({
        kind: z.enum(['lesson', 'review', 'speaking', 'listening', 'writing', 'grammar', 'conversation']),
        focus: z.string(),
        minutes: z.number().int().positive(),
        reason: z.string(),
      }),
    )
    .default([]),
});

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isAiConfigured()) return fail('ai_not_configured', undefined, origin);

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  if (!rateLimit(`coach:${userId}`, 10)) return fail('rate_limited', undefined, origin);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const entitlements = await entitlementsFor(asService, userId);
  if (!entitlements.aiStudyCoach) {
    return json(
      { code: 'subscription_required', feature: 'aiStudyCoach', plan: entitlements.planCode },
      { status: 402 },
      origin,
    );
  }

  const { data: language } = await asUser
    .from('languages')
    .select('id, code, name')
    .eq('code', body.languageCode)
    .maybeSingle();
  if (!language) return fail('not_found', 'language not found', origin);

  const { data: skills } = await asUser
    .from('skill_profiles')
    .select('overall_level, speaking_level, writing_level, listening_level, reading_level')
    .eq('user_id', userId)
    .eq('language_id', language.id)
    .maybeSingle();

  const { data: mistakes } = await asUser
    .from('user_mistakes')
    .select('tag, label, count')
    .eq('user_id', userId)
    .eq('language_id', language.id)
    .is('resolved_at', null)
    .order('count', { ascending: false })
    .limit(6);

  const { count: dueCount } = await asUser
    .from('user_vocabulary')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_at', new Date().toISOString());

  const { data: recent } = await asUser
    .from('user_progress')
    .select('completed_at, lessons(title)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5);

  const lastCompleted = recent?.[0]?.completed_at;
  const daysSince = lastCompleted
    ? Math.floor((Date.now() - new Date(lastCompleted).getTime()) / 86_400_000)
    : 999;

  const system = coachSystemPrompt({
    languageName: language.name,
    nativeLanguageName: 'English',
    cefr: (skills?.overall_level ?? 'A1') as Cefr,
    weakAreas: (mistakes ?? []).map((m) => ({ tag: m.tag, label: m.label, count: m.count })),
    dueVocabulary: dueCount ?? 0,
    daysSinceLastPractice: daysSince,
    minutesAvailable: body.minutesAvailable,
    recentLessons: (recent ?? [])
      .map((r) => (r.lessons as { title?: string } | null)?.title)
      .filter((t): t is string => Boolean(t)),
  });

  let result;
  try {
    result = await complete({
      system,
      messages: [
        {
          role: 'user',
          content: `I have ${body.minutesAvailable} minutes. What should I work on?`,
        },
      ],
      maxTokens: 700,
      temperature: 0.6,
      expectJson: true,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail('ai_not_configured', undefined, origin);
    if (error instanceof AiUnavailableError) return fail('ai_unavailable', undefined, origin);
    throw error;
  }

  let plan;
  try {
    plan = planSchema.parse(extractJson(result.text));
  } catch {
    return fail('ai_unavailable', 'unexpected response from the coach', origin);
  }

  // A plan that does not fit the time the learner has is not a plan.
  const totalMinutes = plan.plan.reduce((sum, step) => sum + step.minutes, 0);
  const trimmed =
    totalMinutes <= body.minutesAvailable
      ? plan.plan
      : plan.plan.reduce<typeof plan.plan>((kept, step) => {
          const used = kept.reduce((sum, s) => sum + s.minutes, 0);
          return used + step.minutes <= body.minutesAvailable ? [...kept, step] : kept;
        }, []);

  await asService.from('ai_sessions').insert({
    user_id: userId,
    language_id: language.id,
    kind: 'coach',
    cefr: skills?.overall_level ?? null,
    status: 'completed',
    turns: 1,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_micros: costMicros(result),
    model: result.model,
    ended_at: new Date().toISOString(),
  });

  await recordAiUsage(asService, userId, 'coach');

  return json({ message: plan.message, plan: trimmed }, {}, origin);
});
