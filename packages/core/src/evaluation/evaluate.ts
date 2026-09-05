import type { Activity, ActivityType, Verdict } from '../activities/types';
import { verdict } from '../activities/types';
import { answerSchemas, promptSchemas } from '../activities/schemas';
import type { Cefr } from '../cefr/levels';
import { accentsAreStrict, normalizeOptionsFor, rulesFor, type LanguageGradingRules } from './languageRules';
import { editDistance, foldAccents, normalizeText, similarity } from './normalize';

export interface EvaluationContext {
  /** Target language being learned, e.g. `es` or `es-MX`. */
  readonly languageCode: string;
  /** Level of the material, used for accent strictness and tolerance. */
  readonly cefr: Cefr;
  /** Hints revealed before answering. */
  readonly hintsUsed: number;
  /** 1 for the first try. Retries score less towards mastery but still count as engagement. */
  readonly attemptNumber: number;
  readonly elapsedMs?: number;
}

export const defaultContext = (languageCode: string, cefr: Cefr): EvaluationContext => ({
  languageCode,
  cefr,
  hintsUsed: 0,
  attemptNumber: 1,
});

/**
 * Grade an attempt.
 *
 * Deterministic first, always. `needsAi` is returned only for genuinely
 * open-ended production (free writing, speech, conversation) or when a
 * near-miss on an open answer cannot be resolved locally — never as a shortcut.
 */
export function evaluateAnswer(activity: Activity, rawAnswer: unknown, ctx: EvaluationContext): Verdict {
  const rules = rulesFor(ctx.languageCode);
  const parsed = answerSchemas[activity.type].safeParse(rawAnswer);
  if (!parsed.success) {
    return verdict({ correct: false, score: 0, errorTags: ['malformed_answer'] });
  }
  const base = gradeByType(activity, parsed.data as never, ctx, rules);
  return applyPenalties(base, ctx);
}

/** Hints and retries reduce the *mastery* contribution, never the engagement XP. */
export function applyPenalties(v: Verdict, ctx: EvaluationContext): Verdict {
  if (!v.correct || v.score === 0) return v;
  const hintPenalty = Math.min(1, ctx.hintsUsed * 0.25);
  const retryPenalty = Math.min(0.5, Math.max(0, ctx.attemptNumber - 1) * 0.25);
  const score = Math.max(0, v.score * (1 - hintPenalty) * (1 - retryPenalty));
  return { ...v, score: round(score) };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------

function gradeByType(
  activity: Activity,
  answer: Record<string, unknown>,
  ctx: EvaluationContext,
  rules: LanguageGradingRules,
): Verdict {
  const type: ActivityType = activity.type;
  switch (type) {
    case 'multiple_choice':
    case 'tap_translation':
    case 'image_match':
    case 'audio_recognition':
      return gradeSingleChoice(activity, answer['optionId'] as string);

    case 'multiple_answer':
      return gradeMultipleAnswer(activity, (answer['optionIds'] as string[]) ?? []);

    case 'listening_comprehension':
    case 'dialogue_completion':
      return 'optionId' in answer
        ? gradeSingleChoice(activity, answer['optionId'] as string)
        : 'blanks' in answer
          ? gradeBlanks(activity, (answer['blanks'] as string[]) ?? [], ctx, rules)
          : gradeOpenText(activity, (answer['text'] as string) ?? '', ctx, rules, { allowAiFallback: true });

    case 'fill_blank':
    case 'story_completion':
      return gradeBlanks(activity, (answer['blanks'] as string[]) ?? [], ctx, rules);

    case 'sentence_order':
      return gradeTokenOrder(activity, (answer['tokens'] as string[]) ?? [], rules);

    case 'word_match':
      return gradePairs(activity, (answer['pairs'] as { left: string; right: string }[]) ?? [], rules);

    case 'drag_drop':
    case 'word_categorization':
      return gradeMapping(activity, (answer['mapping'] as Record<string, string>) ?? {}, rules);

    case 'dictation':
    case 'spelling':
      return gradeOpenText(activity, (answer['text'] as string) ?? '', ctx, rules, {
        allowAiFallback: false,
        caseSensitive: activity.type === 'spelling',
      });

    case 'grammar_correction':
    case 'translation':
      return gradeOpenText(activity, (answer['text'] as string) ?? '', ctx, rules, { allowAiFallback: true });

    case 'pronunciation_repeat':
      return gradePronunciation(activity, answer as { transcript: string; confidence?: number; selfReported?: boolean }, ctx, rules);

    case 'flashcard':
      return gradeFlashcard(answer['quality'] as 'again' | 'hard' | 'good' | 'easy');

    case 'timed_challenge':
    case 'review_challenge':
      return gradeItemSet(activity, (answer['items'] as { id: string; text: string; elapsedMs: number }[]) ?? [], ctx, rules);

    case 'written_response':
    case 'speech_response':
    case 'conversation':
    case 'roleplay':
    case 'scenario_simulation':
      // Genuinely open production: the deterministic layer can only reject empties.
      return gradeOpenProduction(activity, answer, ctx);

    default: {
      const exhaustive: never = type;
      return verdict({ correct: false, score: 0, errorTags: [`unhandled:${String(exhaustive)}`] });
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic graders
// ---------------------------------------------------------------------------

function correctIds(activity: Activity): string[] {
  const answer = activity.correctAnswer;
  if (typeof answer === 'string') return [answer];
  if (Array.isArray(answer)) return answer.map(String);
  if (answer && typeof answer === 'object') {
    const obj = answer as Record<string, unknown>;
    if (typeof obj['optionId'] === 'string') return [obj['optionId']];
    if (Array.isArray(obj['optionIds'])) return (obj['optionIds'] as unknown[]).map(String);
  }
  return [];
}

function gradeSingleChoice(activity: Activity, optionId: string | undefined): Verdict {
  const expected = correctIds(activity);
  const accepted = new Set([...expected, ...acceptableStrings(activity)]);
  const correct = optionId !== undefined && accepted.has(optionId);
  return verdict({
    correct,
    score: correct ? 1 : 0,
    errorTags: correct ? [] : activity.tags,
    feedback: correct ? undefined : choiceFeedback(activity, optionId),
  });
}

function choiceFeedback(activity: Activity, chosen: string | undefined): Verdict['feedback'] {
  const prompt = promptSchemas.multiple_choice.safeParse(activity.prompt);
  const expectedId = correctIds(activity)[0];
  if (!prompt.success || expectedId === undefined) return undefined;
  const chosenOption = prompt.data.options.find((o) => o.id === chosen);
  const correctOption = prompt.data.options.find((o) => o.id === expectedId);
  if (!correctOption) return undefined;
  return {
    yours: chosenOption?.text ?? '',
    better: correctOption.text,
    why: activity.explanation ?? '',
  };
}

function gradeMultipleAnswer(activity: Activity, chosen: string[]): Verdict {
  const expected = new Set(correctIds(activity));
  const picked = new Set(chosen);
  let hits = 0;
  let falsePositives = 0;
  for (const id of picked) (expected.has(id) ? hits++ : falsePositives++);
  const missed = expected.size - hits;

  const prompt = promptSchemas.multiple_answer.safeParse(activity.prompt);
  const partialCredit = prompt.success ? prompt.data.partialCredit : true;

  if (hits === expected.size && falsePositives === 0) {
    return verdict({ correct: true, score: 1 });
  }
  if (!partialCredit || expected.size === 0) {
    return verdict({ correct: false, score: 0, errorTags: activity.tags });
  }
  const raw = (hits - falsePositives) / expected.size;
  const score = Math.max(0, round(raw));
  return verdict({
    correct: false,
    partial: score > 0,
    score: 0, // partial answers earn no mastery credit, only visible partial progress
    errorTags: activity.tags,
    notes: [missed > 0 ? `missing:${missed}` : '', falsePositives > 0 ? `extra:${falsePositives}` : ''].filter(Boolean),
  });
}

function acceptableStrings(activity: Activity): string[] {
  return (activity.acceptableAnswers ?? []).flatMap((a) => {
    if (typeof a === 'string') return [a];
    if (Array.isArray(a)) return a.map(String);
    return [];
  });
}

interface OpenTextOptions {
  readonly allowAiFallback: boolean;
  readonly caseSensitive?: boolean;
}

/**
 * Grade a typed answer against the answer key.
 *
 * Pipeline (brief §52): exact → accepted variants → normalised → accent-only
 * (correct with a note below the strictness threshold) → typo near-miss →
 * AI fallback only when the activity allows it.
 */
export function gradeOpenText(
  activity: Activity,
  input: string,
  ctx: EvaluationContext,
  rules: LanguageGradingRules,
  options: OpenTextOptions,
): Verdict {
  const targets = [
    ...(typeof activity.correctAnswer === 'string' ? [activity.correctAnswer] : []),
    ...acceptableStrings(activity),
  ];
  if (targets.length === 0) {
    return options.allowAiFallback
      ? verdict({ correct: false, score: 0, needsAi: true })
      : verdict({ correct: false, score: 0, errorTags: ['missing_answer_key'] });
  }
  if (input.trim() === '') {
    return verdict({ correct: false, score: 0, errorTags: ['empty'] });
  }

  const normOpts = normalizeOptionsFor(rules, ctx.cefr, { caseSensitive: options.caseSensitive });
  const given = normalizeText(input, normOpts);

  // 1 + 2: exact / accepted variants (raw and normalised).
  for (const target of targets) {
    if (input.trim() === target.trim()) return verdict({ correct: true, score: 1 });
    if (given === normalizeText(target, normOpts)) return verdict({ correct: true, score: 1 });
  }

  const strictAccents = accentsAreStrict(rules, ctx.cefr);

  // 3: accent-only difference.
  const givenFolded = foldAccents(given);
  for (const target of targets) {
    const targetNorm = normalizeText(target, normOpts);
    if (foldAccents(targetNorm) === givenFolded) {
      if (strictAccents) {
        return verdict({
          correct: false,
          score: 0,
          errorTags: ['accent'],
          feedback: { yours: input, better: target, why: activity.explanation ?? '' },
        });
      }
      return verdict({ correct: true, score: 0.9, notes: ['accent'], errorTags: ['accent'] });
    }
  }

  // 4: typo near-miss — wrong, but we can say exactly how close and hint precisely.
  let best = { target: targets[0]!, distance: Number.POSITIVE_INFINITY, sim: 0 };
  for (const target of targets) {
    const targetNorm = normalizeText(target, normOpts);
    const distance = editDistance(givenFolded, foldAccents(targetNorm));
    if (distance < best.distance) best = { target, distance, sim: similarity(givenFolded, foldAccents(targetNorm)) };
  }
  const tolerance = Math.max(1, Math.floor(best.target.length * rules.typoTolerance));
  if (best.distance <= tolerance) {
    return verdict({
      correct: false,
      score: 0,
      partial: true,
      errorTags: ['typo', ...activity.tags],
      feedback: { yours: input, better: best.target, why: 'Almost — check the spelling.' },
      notes: ['near_miss'],
    });
  }

  // 5: hand to the AI evaluator only when the activity is genuinely open.
  if (options.allowAiFallback && best.sim < 0.85) {
    return verdict({ correct: false, score: 0, needsAi: true, errorTags: activity.tags });
  }

  return verdict({
    correct: false,
    score: 0,
    errorTags: activity.tags,
    feedback: { yours: input, better: best.target, why: activity.explanation ?? '' },
  });
}

function gradeBlanks(
  activity: Activity,
  blanks: string[],
  ctx: EvaluationContext,
  rules: LanguageGradingRules,
): Verdict {
  const expected = Array.isArray(activity.correctAnswer) ? (activity.correctAnswer as unknown[]).map(String) : [];
  if (expected.length === 0) return verdict({ correct: false, score: 0, errorTags: ['missing_answer_key'] });

  // Each blank may have its own accepted alternatives:
  // acceptableAnswers = [["voy","me voy"], ["a"]]
  const alternatives = (activity.acceptableAnswers ?? []) as unknown[];
  const normOpts = normalizeOptionsFor(rules, ctx.cefr, { allowOptionalWords: false });
  const strictAccents = accentsAreStrict(rules, ctx.cefr);

  let correctCount = 0;
  let accentOnly = 0;
  const wrong: { index: number; yours: string; better: string }[] = [];

  expected.forEach((target, index) => {
    const given = blanks[index] ?? '';
    const alt = alternatives[index];
    const accepted = [target, ...(Array.isArray(alt) ? (alt as unknown[]).map(String) : [])];
    const givenNorm = normalizeText(given, normOpts);

    const exact = accepted.some((a) => normalizeText(a, normOpts) === givenNorm);
    if (exact) {
      correctCount += 1;
      return;
    }
    const accentMatch = accepted.some((a) => foldAccents(normalizeText(a, normOpts)) === foldAccents(givenNorm));
    if (accentMatch && !strictAccents) {
      correctCount += 1;
      accentOnly += 1;
      return;
    }
    wrong.push({ index, yours: given, better: target });
  });

  const allCorrect = correctCount === expected.length;
  const score = allCorrect ? (accentOnly > 0 ? 0.9 : 1) : 0;
  return verdict({
    correct: allCorrect,
    score,
    partial: !allCorrect && correctCount > 0,
    errorTags: allCorrect ? (accentOnly > 0 ? ['accent'] : []) : ['blank', ...activity.tags],
    notes: accentOnly > 0 ? ['accent'] : [],
    feedback: allCorrect
      ? undefined
      : {
          yours: blanks.join(' / '),
          better: expected.join(' / '),
          why: activity.explanation ?? '',
        },
  });
}

function gradeTokenOrder(activity: Activity, tokens: string[], rules: LanguageGradingRules): Verdict {
  const targets: string[][] = [];
  if (Array.isArray(activity.correctAnswer)) targets.push((activity.correctAnswer as unknown[]).map(String));
  for (const alt of activity.acceptableAnswers ?? []) {
    if (Array.isArray(alt)) targets.push((alt as unknown[]).map(String));
  }
  if (targets.length === 0) return verdict({ correct: false, score: 0, errorTags: ['missing_answer_key'] });

  const norm = (list: string[]) => list.map((t) => normalizeText(t, { caseSensitive: false })).join(' ');
  const given = norm(tokens);
  const correct = targets.some((t) => norm(t) === given);
  if (correct) return verdict({ correct: true, score: 1 });

  // Right words, wrong order is a different mistake from missing words entirely.
  const targetSorted = [...targets[0]!].map((t) => normalizeText(t)).sort().join(' ');
  const givenSorted = [...tokens].map((t) => normalizeText(t)).sort().join(' ');
  const wordOrderOnly = targetSorted === givenSorted;

  return verdict({
    correct: false,
    score: 0,
    partial: wordOrderOnly,
    errorTags: [wordOrderOnly ? 'word_order' : 'construction', ...activity.tags],
    feedback: {
      yours: tokens.join(rules.spaceSeparated ? ' ' : ''),
      better: targets[0]!.join(rules.spaceSeparated ? ' ' : ''),
      why: activity.explanation ?? '',
    },
  });
}

function gradePairs(
  activity: Activity,
  pairs: { left: string; right: string }[],
  _rules: LanguageGradingRules,
): Verdict {
  const prompt = promptSchemas.word_match.safeParse(activity.prompt);
  if (!prompt.success) return verdict({ correct: false, score: 0, errorTags: ['malformed_prompt'] });

  const expected = new Map(prompt.data.pairs.map((p) => [normalizeText(p.left), normalizeText(p.right)]));
  let hits = 0;
  const wrong: string[] = [];
  for (const pair of pairs) {
    if (expected.get(normalizeText(pair.left)) === normalizeText(pair.right)) hits += 1;
    else wrong.push(pair.left);
  }
  const total = expected.size;
  const correct = hits === total && pairs.length === total;
  return verdict({
    correct,
    score: correct ? 1 : 0,
    partial: !correct && hits > 0,
    errorTags: correct ? [] : ['matching', ...activity.tags],
    notes: wrong.length ? [`wrong:${wrong.length}`] : [],
  });
}

function gradeMapping(
  activity: Activity,
  mapping: Record<string, string>,
  _rules: LanguageGradingRules,
): Verdict {
  const expected = (activity.correctAnswer ?? {}) as Record<string, string>;
  const keys = Object.keys(expected);
  if (keys.length === 0) return verdict({ correct: false, score: 0, errorTags: ['missing_answer_key'] });

  let hits = 0;
  const wrongItems: string[] = [];
  for (const key of keys) {
    if (normalizeText(mapping[key] ?? '') === normalizeText(expected[key] ?? '')) hits += 1;
    else wrongItems.push(key);
  }
  const correct = hits === keys.length;
  return verdict({
    correct,
    score: correct ? 1 : 0,
    partial: !correct && hits > 0,
    errorTags: correct ? [] : ['categorisation', ...activity.tags],
    notes: wrongItems.length ? wrongItems.slice(0, 5).map((w) => `wrong:${w}`) : [],
  });
}

/**
 * Pronunciation is graded from the speech recogniser's transcript, not from a
 * signal-level model. The UI states that this is guidance, not a clinical
 * assessment (brief §24).
 */
function gradePronunciation(
  activity: Activity,
  answer: { transcript: string; confidence?: number; selfReported?: boolean },
  ctx: EvaluationContext,
  rules: LanguageGradingRules,
): Verdict {
  const prompt = promptSchemas.pronunciation_repeat.safeParse(activity.prompt);
  if (!prompt.success) return verdict({ correct: false, score: 0, errorTags: ['malformed_prompt'] });

  // No recogniser on this device: the learner compares themselves to the model
  // audio. We record the attempt but do not score it.
  if (answer.selfReported) {
    return verdict({ correct: true, score: 0, notes: ['unscored_self_reported'] });
  }
  if (!answer.transcript.trim()) {
    return verdict({ correct: false, score: 0, errorTags: ['no_speech_detected'] });
  }

  const normOpts = normalizeOptionsFor(rules, ctx.cefr, { allowOptionalWords: false });
  const target = normalizeText(prompt.data.target, normOpts);
  const given = normalizeText(answer.transcript, normOpts);
  const sim = similarity(foldAccents(given), foldAccents(target));

  // Recogniser confidence is advisory: a low-confidence perfect transcript is
  // still likely a good attempt in a noisy room.
  const threshold = 0.8;
  const correct = sim >= threshold;
  return verdict({
    correct,
    score: correct ? round(Math.min(1, sim)) : 0,
    partial: !correct && sim >= 0.6,
    errorTags: correct ? [] : ['pronunciation', ...prompt.data.focusPhonemes.map((p) => `phoneme:${p}`)],
    feedback: correct
      ? undefined
      : { yours: answer.transcript, better: prompt.data.target, why: activity.explanation ?? '' },
    notes: [`similarity:${round(sim)}`],
  });
}

/** Self-graded flashcards feed the SRS scheduler rather than a right/wrong verdict. */
function gradeFlashcard(quality: 'again' | 'hard' | 'good' | 'easy' | undefined): Verdict {
  const map = { again: 0, hard: 0.6, good: 0.85, easy: 1 } as const;
  const score = quality ? map[quality] : 0;
  return verdict({ correct: score >= 0.6, score, notes: [`self:${quality ?? 'none'}`] });
}

function gradeItemSet(
  activity: Activity,
  items: { id: string; text: string; elapsedMs: number }[],
  ctx: EvaluationContext,
  rules: LanguageGradingRules,
): Verdict {
  const prompt = promptSchemas.timed_challenge.safeParse(activity.prompt);
  const expected = prompt.success ? new Map(prompt.data.items.map((i) => [i.id, i.answer])) : new Map<string, string>();
  if (expected.size === 0) {
    // review_challenge items are drawn at runtime; the caller grades each item
    // individually and reports the aggregate.
    return verdict({ correct: false, score: 0, errorTags: ['runtime_items'] });
  }
  const normOpts = normalizeOptionsFor(rules, ctx.cefr);
  let hits = 0;
  for (const item of items) {
    const target = expected.get(item.id);
    if (target && normalizeText(item.text, normOpts) === normalizeText(target, normOpts)) hits += 1;
  }
  const ratio = hits / expected.size;
  const correct = ratio >= 0.8;
  return verdict({
    correct,
    score: correct ? round(ratio) : 0,
    partial: !correct && hits > 0,
    errorTags: correct ? [] : activity.tags,
    notes: [`correct:${hits}/${expected.size}`],
  });
}

/**
 * Free production. The deterministic layer only rejects answers that cannot
 * possibly be graded (empty, or below a required length); everything else goes
 * to `ai-evaluate` with a rubric.
 */
function gradeOpenProduction(activity: Activity, answer: Record<string, unknown>, _ctx: EvaluationContext): Verdict {
  const text =
    typeof answer['text'] === 'string'
      ? (answer['text'] as string)
      : typeof answer['transcript'] === 'string'
        ? (answer['transcript'] as string)
        : Array.isArray(answer['turns'])
          ? (answer['turns'] as { role: string; text: string }[])
              .filter((t) => t.role === 'learner')
              .map((t) => t.text)
              .join(' ')
          : '';

  if (!text.trim()) {
    return verdict({ correct: false, score: 0, errorTags: ['empty'] });
  }
  const minWords = activity.rubric?.minWords;
  if (minWords && text.trim().split(/\s+/).length < minWords) {
    return verdict({
      correct: false,
      score: 0,
      errorTags: ['too_short'],
      feedback: { yours: text, better: '', why: `Write at least ${minWords} words.` },
    });
  }
  return verdict({ correct: false, score: 0, needsAi: true });
}
