import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticate } from '../_shared/auth.ts';
import { fail, json, parseBody, preflight } from '../_shared/http.ts';

/**
 * Scores an adaptive placement attempt (brief §30).
 *
 * Deliberately not a "five questions, therefore B1" endpoint: it walks the
 * ladder the learner actually took, reports a range and a confidence, gives a
 * per-skill estimate only where enough items were seen, and recommends a
 * starting level that is never above the estimate.
 *
 * Mirrors @lingonest/core/adaptive/placement, which is unit-tested.
 */

const bodySchema = z.object({
  attemptId: z.string().uuid(),
  languageCode: z.string().min(2).max(5),
  responses: z
    .array(
      z.object({
        itemId: z.string(),
        cefr: z.enum(['PRE_A1', 'A1', 'A2', 'A2_PLUS', 'B1', 'B1_PLUS', 'B2', 'B2_PLUS', 'C1', 'C2']),
        skill: z.enum([
          'reading',
          'listening',
          'speaking',
          'writing',
          'vocabulary',
          'grammar',
          'pronunciation',
          'interaction',
          'mediation',
        ]),
        correct: z.boolean(),
        responseMs: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(60),
});

const LADDER = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type Cefr = (typeof LADDER)[number] | 'A2_PLUS' | 'B1_PLUS' | 'B2_PLUS';

const PASS_THRESHOLD = 0.65;
const MIN_ITEMS = 12;

function majorOf(cefr: string): (typeof LADDER)[number] {
  const major = cefr.replace('_PLUS', '');
  return (LADDER as readonly string[]).includes(major) ? (major as (typeof LADDER)[number]) : 'PRE_A1';
}

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

  const { data: attempt } = await asUser
    .from('assessment_attempts')
    .select('id, user_id, assessment_id, state')
    .eq('id', body.attemptId)
    .maybeSingle();

  if (!attempt || attempt.user_id !== userId) return fail('not_found', 'attempt not found', origin);
  if (attempt.state === 'completed') return fail('conflict', 'this attempt is already scored', origin);

  const { data: language } = await asUser
    .from('languages')
    .select('id, code')
    .eq('code', body.languageCode)
    .maybeSingle();
  if (!language) return fail('not_found', 'language not found', origin);

  // --- estimate ------------------------------------------------------------
  const byLevel = new Map<string, { correct: number; total: number }>();
  for (const response of body.responses) {
    const level = majorOf(response.cefr);
    const entry = byLevel.get(level) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (response.correct) entry.correct += 1;
    byLevel.set(level, entry);
  }

  let highestPassed: (typeof LADDER)[number] = 'PRE_A1';
  let lowestFailed: (typeof LADDER)[number] | null = null;

  for (const level of LADDER) {
    const stats = byLevel.get(level);
    if (!stats || stats.total < 2) continue;
    const rate = stats.correct / stats.total;
    if (rate >= PASS_THRESHOLD) {
      highestPassed = level;
    } else if (lowestFailed === null) {
      lowestFailed = level;
    }
  }

  const bySkill: Record<string, string> = {};
  const unassessed: string[] = [];
  const skills = [...new Set(body.responses.map((r) => r.skill))];

  for (const skill of [
    'reading',
    'listening',
    'speaking',
    'writing',
    'vocabulary',
    'grammar',
    'pronunciation',
    'interaction',
    'mediation',
  ]) {
    const forSkill = body.responses.filter((r) => r.skill === skill);
    if (forSkill.length < 3) {
      unassessed.push(skill);
      continue;
    }
    let best: (typeof LADDER)[number] = 'PRE_A1';
    for (const level of LADDER) {
      const atLevel = forSkill.filter((r) => majorOf(r.cefr) === level);
      if (atLevel.length === 0) continue;
      const rate = atLevel.filter((r) => r.correct).length / atLevel.length;
      if (rate >= PASS_THRESHOLD) best = level;
    }
    bySkill[skill] = best;
  }

  const coverage = Math.min(1, body.responses.length / MIN_ITEMS);
  const breadth = Math.min(1, byLevel.size / 3);
  const confidence = Math.round((0.6 * coverage + 0.4 * breadth) * 1000) / 1000;

  const highIndex = LADDER.indexOf(highestPassed);
  const range = {
    low: LADDER[Math.max(0, highIndex - 1)]!,
    high: lowestFailed ?? LADDER[Math.min(LADDER.length - 1, highIndex + 1)]!,
  };

  // Being placed slightly too low is recoverable in a session; being placed too
  // high makes the product feel impossible.
  const recommendedStart = confidence >= 0.7 ? highestPassed : LADDER[Math.max(0, highIndex - 1)]!;

  // --- persist -------------------------------------------------------------
  const score = body.responses.filter((r) => r.correct).length / body.responses.length;

  await asService
    .from('assessment_attempts')
    .update({
      state: 'completed',
      responses: body.responses,
      per_skill_scores: bySkill,
      estimated_levels: { overall: highestPassed, ...bySkill },
      result_summary: { range, confidence, recommendedStart, unassessedSkills: unassessed },
      score,
      finished_at: new Date().toISOString(),
    })
    .eq('id', attempt.id);

  // Placement is evidence, not a verdict: it seeds the skill profile with
  // weighted evidence rows that later work will build on or overturn.
  const { data: profile } = await asService
    .from('skill_profiles')
    .upsert({ user_id: userId, language_id: language.id }, { onConflict: 'user_id,language_id' })
    .select('id')
    .single();

  if (profile) {
    const evidence = skills.map((skill) => {
      const forSkill = body.responses.filter((r) => r.skill === skill);
      const rate = forSkill.filter((r) => r.correct).length / forSkill.length;
      const level = forSkill.reduce<string>((highest, r) => {
        const major = majorOf(r.cefr);
        return LADDER.indexOf(major) > LADDER.indexOf(highest as (typeof LADDER)[number]) ? major : highest;
      }, 'PRE_A1');
      return {
        profile_id: profile.id,
        skill,
        cefr: level,
        score: Math.round(rate * 1000) / 1000,
        source: 'placement',
        source_id: attempt.id,
        weight: Math.min(3, forSkill.length / 3),
      };
    });
    if (evidence.length > 0) await asService.from('skill_evidence').insert(evidence);

    await asService
      .from('skill_profiles')
      .update({
        overall_level: highestPassed,
        reading_level: bySkill.reading ?? null,
        listening_level: bySkill.listening ?? null,
        speaking_level: bySkill.speaking ?? null,
        writing_level: bySkill.writing ?? null,
        vocabulary_level: bySkill.vocabulary ?? null,
        grammar_level: bySkill.grammar ?? null,
        confidence,
      })
      .eq('id', profile.id);
  }

  return json(
    {
      estimated: highestPassed,
      range,
      confidence,
      bySkill,
      unassessedSkills: unassessed,
      recommendedStart,
      itemsAnswered: body.responses.length,
      // Copy the UI shows verbatim: an estimate, never a certification.
      summaryKey: confidence >= 0.7 ? 'placement.result.confident' : 'placement.result.provisional',
    },
    {},
    origin,
  );
});
