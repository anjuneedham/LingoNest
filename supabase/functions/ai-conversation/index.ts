import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, log, parseBody, preflight, rateLimit } from '../_shared/http.ts';
import { isAiConfigured } from '../_shared/env.ts';
import { AiNotConfiguredError, AiUnavailableError, complete, costMicros, extractJson } from '../_shared/anthropic.ts';
import { checkAiUsage, entitlementsFor, recordAiUsage } from '../_shared/entitlements.ts';
import { conversationSystemPrompt, type Cefr } from '../_shared/prompts.ts';

/**
 * AI conversation practice.
 *
 * The client sends a scenario key and the learner's text. Everything that
 * shapes the model's behaviour — the character, the level, the difficulty
 * profile, the learner's weak areas — is assembled here from database rows.
 */

const bodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  scenarioKey: z.string().min(1),
  languageCode: z.string().min(2).max(5),
  text: z.string().max(2000),
  /** True when the text came from speech recognition rather than typing. */
  fromSpeech: z.boolean().default(false),
});

const replySchema = z.object({
  reply: z.string().min(1),
  translation: z.string().default(''),
  correction: z
    .object({ learnerSaid: z.string(), better: z.string(), why: z.string() })
    .nullable()
    .default(null),
  goalsAchieved: z.array(z.string()).default([]),
  conversationComplete: z.boolean().default(false),
});

const MAX_TURNS = 40;

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isAiConfigured()) {
    return fail('ai_not_configured', 'AI practice is not configured in this environment', origin);
  }

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  if (!rateLimit(`conv:${userId}`, 20)) {
    return fail('rate_limited', 'too many requests', origin);
  }

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  // --- entitlement check, before any spend ---------------------------------
  const entitlements = await entitlementsFor(asService, userId);
  const usage = await checkAiUsage(asService, userId, 'conversation', entitlements);
  if (!usage.allowed && !body.sessionId) {
    return json(
      { code: 'ai_limit_reached', used: usage.used, limit: usage.limit, plan: entitlements.planCode },
      { status: 402 },
      origin,
    );
  }

  // --- context, read as the user so RLS still applies ----------------------
  const { data: scenario } = await asUser
    .from('conversation_scenarios')
    .select('id, key, title, setting, partner_role, learner_role, cefr, goals, complications, opening_line, language_id')
    .eq('key', body.scenarioKey)
    .eq('status', 'published')
    .maybeSingle();

  if (!scenario) return fail('not_found', 'scenario not found', origin);

  const { data: language } = await asUser
    .from('languages')
    .select('id, code, name')
    .eq('id', scenario.language_id)
    .maybeSingle();
  if (!language) return fail('not_found', 'language not found', origin);

  const { data: profile } = await asUser
    .from('profiles')
    .select('display_name, ui_locale')
    .eq('id', userId)
    .maybeSingle();

  const { data: skills } = await asUser
    .from('skill_profiles')
    .select('speaking_level, interaction_level, overall_level')
    .eq('user_id', userId)
    .eq('language_id', language.id)
    .maybeSingle();

  const { data: userLanguage } = await asUser
    .from('user_languages')
    .select('variant_id')
    .eq('user_id', userId)
    .eq('language_id', language.id)
    .maybeSingle();

  let variantLabel: string | undefined;
  if (userLanguage?.variant_id) {
    const { data: variant } = await asUser
      .from('language_variants')
      .select('label')
      .eq('id', userLanguage.variant_id)
      .maybeSingle();
    variantLabel = variant?.label ?? undefined;
  }

  const { data: mistakes } = await asUser
    .from('user_mistakes')
    .select('label, count')
    .eq('user_id', userId)
    .eq('language_id', language.id)
    .is('resolved_at', null)
    .order('count', { ascending: false })
    .limit(5);

  // Use the learner's own speaking level where we have one; otherwise the
  // scenario's level. Never above the scenario, so practice stays achievable.
  const cefr = (skills?.speaking_level ?? skills?.interaction_level ?? scenario.cefr) as Cefr;

  // --- session ------------------------------------------------------------
  let sessionId = body.sessionId ?? null;
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  let isNewSession = false;

  if (sessionId) {
    const { data: session } = await asUser
      .from('ai_sessions')
      .select('id, turns, status')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!session) return fail('not_found', 'session not found', origin);
    if (session.turns >= MAX_TURNS) {
      return fail('conflict', 'this conversation has reached its length limit', origin);
    }

    const { data: messages } = await asUser
      .from('ai_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(60);

    history = (messages ?? [])
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  } else {
    isNewSession = true;
    const { data: created, error } = await asService
      .from('ai_sessions')
      .insert({
        user_id: userId,
        language_id: language.id,
        kind: 'conversation',
        scenario_id: scenario.id,
        cefr,
        persona: scenario.partner_role,
        goals: scenario.goals,
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !created) return fail('unknown', 'could not start a session', origin);
    sessionId = created.id;

    // The character opens; the learner replies to something.
    await asService.from('ai_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: scenario.opening_line,
    });
    history = [{ role: 'assistant', content: scenario.opening_line }];
  }

  // An empty first message just starts the scenario.
  if (isNewSession && body.text.trim() === '') {
    await recordAiUsage(asService, userId, 'conversation');
    return json(
      {
        sessionId,
        reply: scenario.opening_line,
        translation: '',
        correction: null,
        goals: scenario.goals,
        goalsAchieved: [],
        conversationComplete: false,
        usage: { used: usage.used + 1, limit: usage.limit },
      },
      {},
      origin,
    );
  }

  // --- call the model ------------------------------------------------------
  const system = conversationSystemPrompt({
    languageName: language.name,
    languageCode: language.code,
    variantLabel,
    cefr,
    scenario: {
      title: scenario.title,
      setting: scenario.setting,
      partnerRole: scenario.partner_role,
      learnerRole: scenario.learner_role,
      goals: scenario.goals ?? [],
      complications: scenario.complications ?? [],
    },
    weakAreas: (mistakes ?? []).map((m) => m.label),
    learnerName: profile?.display_name,
    nativeLanguageName: 'English',
  });

  let result;
  try {
    result = await complete({
      system,
      // The learner's text is passed as an ordinary user turn. The system
      // prompt tells the character to ignore instructions inside it.
      messages: [...history, { role: 'user', content: body.text }],
      maxTokens: 600,
      temperature: 0.8,
      expectJson: true,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail('ai_not_configured', undefined, origin);
    if (error instanceof AiUnavailableError) {
      log('ai_conversation_failed', { status: error.status });
      return fail('ai_unavailable', 'the tutor is unavailable right now', origin);
    }
    throw error;
  }

  let reply;
  try {
    reply = replySchema.parse(extractJson(result.text));
  } catch {
    log('ai_conversation_bad_shape', { sessionId: String(sessionId) });
    return fail('ai_unavailable', 'unexpected response from the tutor', origin);
  }

  // --- persist -------------------------------------------------------------
  await asService.from('ai_messages').insert([
    { session_id: sessionId, role: 'user', content: body.text },
    {
      session_id: sessionId,
      role: 'assistant',
      content: reply.reply,
      translation: reply.translation,
      evaluation: reply.correction,
    },
  ]);

  const goals: string[] = scenario.goals ?? [];
  const achieved = reply.goalsAchieved.filter((g) => goals.includes(g));

  const { data: session } = await asService
    .from('ai_sessions')
    .select('turns, input_tokens, output_tokens, cost_micros, goals_achieved')
    .eq('id', sessionId)
    .single();

  const mergedGoals = [...new Set([...(session?.goals_achieved ?? []), ...achieved])];
  const complete_ = reply.conversationComplete || mergedGoals.length >= goals.length;

  await asService
    .from('ai_sessions')
    .update({
      turns: (session?.turns ?? 0) + 1,
      input_tokens: (session?.input_tokens ?? 0) + result.inputTokens,
      output_tokens: (session?.output_tokens ?? 0) + result.outputTokens,
      cost_micros: (session?.cost_micros ?? 0) + costMicros(result),
      model: result.model,
      goals_achieved: mergedGoals,
      status: complete_ ? 'completed' : 'active',
      ended_at: complete_ ? new Date().toISOString() : null,
    })
    .eq('id', sessionId);

  if (isNewSession) await recordAiUsage(asService, userId, 'conversation');

  return json(
    {
      sessionId,
      reply: reply.reply,
      translation: reply.translation,
      correction: reply.correction,
      goals,
      goalsAchieved: mergedGoals,
      conversationComplete: complete_,
      usage: { used: usage.used + (isNewSession ? 1 : 0), limit: usage.limit },
    },
    {},
    origin,
  );
});
