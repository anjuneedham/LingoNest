import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, log, parseBody, preflight, rateLimit } from '../_shared/http.ts';
import { isAiConfigured } from '../_shared/env.ts';
import { AiNotConfiguredError, AiUnavailableError, complete, costMicros, extractJson } from '../_shared/anthropic.ts';
import { checkAiUsage, entitlementsFor, recordAiUsage } from '../_shared/entitlements.ts';
import { evaluationSystemPrompt, type Cefr } from '../_shared/prompts.ts';

/**
 * Grades free production — writing, speech responses, open translation.
 *
 * Deterministic grading has already run on the device and only sent work here
 * when it genuinely could not decide (see @lingonest/core/evaluation). The
 * guards at the end of this function are what stop the model marking everything
 * correct.
 */

const bodySchema = z.object({
  activityId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  languageCode: z.string().min(2).max(5),
  cefr: z.string(),
  skill: z.enum(['writing', 'speaking', 'mediation', 'interaction']),
  task: z.string().min(1).max(2000),
  answer: z.string().min(1).max(4000),
  rubric: z.object({
    goal: z.string(),
    criteria: z.array(z.string()).min(1),
    mustInclude: z.array(z.string()).optional(),
  }),
  reference: z.string().optional(),
});

const verdictSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  detectedLanguage: z.string().optional(),
  errors: z
    .array(
      z.object({
        span: z.string(),
        correction: z.string(),
        type: z.enum(['grammar', 'vocabulary', 'spelling', 'word_order', 'register', 'pronunciation', 'meaning']),
        explanation: z.string(),
      }),
    )
    .default([]),
  better: z.string().default(''),
  why: z.string().default(''),
  strengths: z.array(z.string()).default([]),
  vocabularyUpgrades: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
  goalsAchieved: z.array(z.string()).default([]),
});

/** Function words excluded when checking whether two answers share content. */
const STOP_WORDS: Record<string, string[]> = {
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'que', 'y', 'a', 'en', 'es'],
  en: ['the', 'a', 'an', 'of', 'to', 'and', 'is', 'are', 'in', 'it'],
  fr: ['le', 'la', 'les', 'un', 'une', 'de', 'des', 'et', 'à', 'en', 'est'],
  ja: ['は', 'が', 'を', 'に', 'で', 'の', 'と', 'も'],
};

function contentOverlap(a: string, b: string, languageCode: string): number {
  const stop = new Set(STOP_WORDS[languageCode.split('-')[0]!] ?? []);
  const words = (text: string) =>
    new Set(
      text
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 1 && !stop.has(w)),
    );
  const setA = words(a);
  const setB = words(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const word of setA) if (setB.has(word)) shared += 1;
  return shared / Math.min(setA.size, setB.size);
}

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  const origin = request.headers.get('origin');

  if (!isAiConfigured()) {
    return fail('ai_not_configured', 'AI feedback is not configured in this environment', origin);
  }

  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { userId, asUser, asService } = auth.context;

  if (!rateLimit(`eval:${userId}`, 30)) return fail('rate_limited', undefined, origin);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const entitlements = await entitlementsFor(asService, userId);
  const usage = await checkAiUsage(asService, userId, 'evaluation', entitlements);
  if (!usage.allowed) {
    return json(
      { code: 'ai_limit_reached', used: usage.used, limit: usage.limit, plan: entitlements.planCode },
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

  const system = evaluationSystemPrompt({
    languageName: language.name,
    nativeLanguageName: 'English',
    cefr: body.cefr as Cefr,
    task: body.task,
    rubric: body.rubric,
    skill: body.skill,
    reference: body.reference,
  });

  let result;
  try {
    result = await complete({
      system,
      messages: [{ role: 'user', content: `The learner wrote:\n\n${body.answer}` }],
      maxTokens: 900,
      temperature: 0.2,
      expectJson: true,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail('ai_not_configured', undefined, origin);
    if (error instanceof AiUnavailableError) return fail('ai_unavailable', undefined, origin);
    throw error;
  }

  let verdict;
  try {
    verdict = verdictSchema.parse(extractJson(result.text));
  } catch {
    log('ai_evaluate_bad_shape', { skill: body.skill });
    return fail('ai_unavailable', 'unexpected response from the evaluator', origin);
  }

  // ---------------------------------------------------------------------
  // Guards. The model is not permitted to be generous about an answer that
  // plainly is not the task (brief §52).
  // ---------------------------------------------------------------------
  const notes: string[] = [];
  let correct = verdict.correct;
  let score = verdict.score;

  if (body.answer.trim().length === 0) {
    correct = false;
    score = 0;
    notes.push('empty');
  }

  const baseLanguage = body.languageCode.split('-')[0]!.toLowerCase();
  if (verdict.detectedLanguage && verdict.detectedLanguage.split('-')[0]!.toLowerCase() !== baseLanguage) {
    correct = false;
    score = 0;
    notes.push('wrong_language');
  }

  if (correct && body.reference && contentOverlap(body.answer, body.reference, baseLanguage) === 0) {
    correct = false;
    score = Math.min(score, 0.2);
    notes.push('no_content_overlap');
  }

  const missing = (body.rubric.mustInclude ?? []).filter(
    (required) => !body.answer.toLocaleLowerCase().includes(required.toLocaleLowerCase()),
  );
  if (correct && missing.length > 0) {
    correct = false;
    score = Math.min(score, 0.5);
    notes.push(`missing_required:${missing.length}`);
  }

  if (!correct) score = Math.min(score, 0.5);

  // ---------------------------------------------------------------------
  // Record the session, the usage and the evidence.
  // ---------------------------------------------------------------------
  const { data: session } = await asService
    .from('ai_sessions')
    .insert({
      user_id: userId,
      language_id: language.id,
      kind: 'evaluation',
      lesson_id: body.lessonId ?? null,
      cefr: body.cefr,
      status: 'completed',
      turns: 1,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_micros: costMicros(result),
      model: result.model,
      ended_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (session) {
    await asService.from('ai_messages').insert([
      { session_id: session.id, role: 'user', content: body.answer },
      { session_id: session.id, role: 'assistant', content: verdict.why, evaluation: verdict },
    ]);
  }

  await recordAiUsage(asService, userId, 'evaluation');

  // Errors the model found become mistake signals for the adaptive engine.
  if (verdict.errors.length > 0) {
    for (const error of verdict.errors.slice(0, 5)) {
      await asService
        .from('user_mistakes')
        .upsert(
          {
            user_id: userId,
            language_id: language.id,
            tag: `${error.type}:ai`,
            label: `${error.type} errors in ${body.skill}`,
            skill: body.skill === 'speaking' ? 'speaking' : 'writing',
            count: 1,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,language_id,tag', ignoreDuplicates: false },
        );
    }
  }

  return json(
    {
      correct,
      score: Math.round(score * 1000) / 1000,
      errors: verdict.errors,
      better: verdict.better,
      why: verdict.why,
      strengths: verdict.strengths,
      vocabularyUpgrades: verdict.vocabularyUpgrades,
      goalsAchieved: verdict.goalsAchieved,
      notes,
      usage: { used: usage.used + 1, limit: usage.limit },
      // Stated plainly so the UI can repeat it: this is guidance, not a grade.
      disclaimer:
        body.skill === 'speaking'
          ? 'Pronunciation feedback is based on speech recognition and is guidance, not a clinical assessment.'
          : undefined,
    },
    {},
    origin,
  );
});
