import { z } from 'zod';
import type { Activity, Verdict } from '../activities/types';
import { verdict } from '../activities/types';
import { contentWordOverlap } from './normalize';
import { rulesFor } from './languageRules';

/**
 * Contract the AI evaluator must satisfy. The Edge Function validates the
 * model's JSON against this before it is trusted, and `guardAiVerdict` applies
 * the sanity checks that stop the model from marking everything correct
 * (brief §52).
 */
export const aiVerdictSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(1),
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
  detectedLanguage: z.string().optional(),
});

export type AiVerdict = z.infer<typeof aiVerdictSchema>;

export interface GuardOptions {
  /** Language the learner is supposed to be producing. */
  readonly targetLanguage: string;
  /** The learner's submitted text. */
  readonly learnerText: string;
  /** Reference text when one exists (translation target, model answer). */
  readonly reference?: string;
}

/**
 * Convert a model verdict into a domain `Verdict`, rejecting verdicts that are
 * not credible:
 *
 *  - empty or whitespace-only answers can never be correct;
 *  - an answer the model itself says is in the wrong language is not correct;
 *  - when a reference answer exists, a "correct" verdict that shares no content
 *    words with it is downgraded — the model is not allowed to be generous
 *    about an answer that plainly is not the task;
 *  - a rubric's `mustInclude` requirements are checked in code, not left to the
 *    model's judgement.
 */
export function guardAiVerdict(raw: unknown, activity: Activity, options: GuardOptions): Verdict {
  const parsed = aiVerdictSchema.safeParse(raw);
  if (!parsed.success) {
    return verdict({ correct: false, score: 0, errorTags: ['ai_invalid_response'], notes: ['ai_schema_rejected'] });
  }
  const ai = parsed.data;
  const text = options.learnerText.trim();
  const rules = rulesFor(options.targetLanguage);
  const stopWords = new Set(rules.stopWords);
  const notes: string[] = [];
  let correct = ai.correct;
  let score = ai.score;

  if (text === '') {
    return verdict({ correct: false, score: 0, errorTags: ['empty'] });
  }

  const base = options.targetLanguage.split('-')[0]!.toLowerCase();
  if (ai.detectedLanguage && ai.detectedLanguage.split('-')[0]!.toLowerCase() !== base) {
    correct = false;
    score = 0;
    notes.push('wrong_language');
  }

  if (correct && options.reference) {
    const overlap = contentWordOverlap(text, options.reference, stopWords);
    if (overlap === 0) {
      correct = false;
      score = Math.min(score, 0.2);
      notes.push('no_content_overlap');
    }
  }

  const mustInclude = activity.rubric?.mustInclude ?? [];
  if (correct && mustInclude.length > 0) {
    const lower = text.toLocaleLowerCase();
    const missing = mustInclude.filter((m) => !lower.includes(m.toLocaleLowerCase()));
    if (missing.length > 0) {
      correct = false;
      score = Math.min(score, 0.5);
      notes.push(`missing_required:${missing.length}`);
    }
  }

  if (!correct) score = Math.min(score, 0.5);

  return verdict({
    correct,
    score: Math.round(score * 1000) / 1000,
    partial: !correct && score > 0,
    errorTags: [...ai.errors.map((e) => `${e.type}`), ...activity.tags],
    feedback: {
      yours: text,
      better: ai.better,
      why: ai.why || ai.errors[0]?.explanation || '',
    },
    notes: [...notes, ...ai.strengths.map((s) => `strength:${s}`)],
  });
}
