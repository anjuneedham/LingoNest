import { z } from 'zod';
import { CEFR_LEVELS } from '../cefr/levels';
import { SKILLS } from '../skills/skills';

/** The 26 interactive activity types (brief §13). */
export const ACTIVITY_TYPES = [
  'multiple_choice',
  'multiple_answer',
  'tap_translation',
  'fill_blank',
  'drag_drop',
  'sentence_order',
  'word_match',
  'image_match',
  'audio_recognition',
  'listening_comprehension',
  'pronunciation_repeat',
  'speech_response',
  'written_response',
  'translation',
  'conversation',
  'roleplay',
  'flashcard',
  'dictation',
  'spelling',
  'grammar_correction',
  'word_categorization',
  'story_completion',
  'dialogue_completion',
  'scenario_simulation',
  'timed_challenge',
  'review_challenge',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Stages of the standard lesson flow (brief §14). */
export const LESSON_STAGES = [
  'introduce',
  'discover',
  'listen',
  'understand',
  'practice',
  'speak',
  'build',
  'converse',
  'apply',
  'review',
] as const;

export type LessonStage = (typeof LESSON_STAGES)[number];

/** How an answer is graded. AI is a last resort, never the default (brief §52). */
export type EvaluationMode = 'deterministic' | 'assisted' | 'ai';

export const cefrSchema = z.enum(CEFR_LEVELS);
export const skillSchema = z.enum(SKILLS);
export const stageSchema = z.enum(LESSON_STAGES);
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

/** A progressive hint. Level 1 is the gentlest; the last level reveals the answer. */
export const hintSchema = z.object({
  level: z.number().int().min(1).max(5),
  kind: z.enum(['context', 'vocabulary', 'grammar', 'partial', 'answer']),
  text: z.string().min(1),
});
export type Hint = z.infer<typeof hintSchema>;

export const mediaRefSchema = z.object({
  /** Stable asset key resolved against `media_assets`; never a raw third-party URL. */
  assetKey: z.string().min(1),
  kind: z.enum(['audio', 'image', 'video']),
  /** Playback renditions for listening material at different speeds. */
  speed: z.enum(['slow', 'normal', 'natural']).optional(),
  transcript: z.string().optional(),
  altText: z.string().optional(),
});
export type MediaRef = z.infer<typeof mediaRefSchema>;

export const rubricSchema = z.object({
  goal: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(1),
  /** Words/structures the learner is expected to use. Used to sanity-check AI verdicts. */
  mustInclude: z.array(z.string()).optional(),
  minWords: z.number().int().positive().optional(),
});
export type Rubric = z.infer<typeof rubricSchema>;

export const activitySchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1).optional(),
  type: activityTypeSchema,
  ordinal: z.number().int().nonnegative(),
  stage: stageSchema,
  skill: skillSchema,
  cefr: cefrSchema,
  difficulty: z.number().int().min(1).max(5),
  /** Type-specific payload; validated by the registry's `promptSchema`. */
  prompt: z.unknown(),
  correctAnswer: z.unknown().optional(),
  acceptableAnswers: z.array(z.unknown()).optional(),
  hints: z.array(hintSchema).default([]),
  explanation: z.string().optional(),
  media: z.array(mediaRefSchema).default([]),
  rubric: rubricSchema.optional(),
  points: z.number().int().nonnegative().default(10),
  timeLimitSeconds: z.number().int().positive().optional(),
  /** Tags used by the adaptive engine: grammar topic ids, vocabulary ids, phonemes. */
  tags: z.array(z.string()).default([]),
  /** Regional variants this activity applies to; empty = all. */
  variants: z.array(z.string()).default([]),
});

export type Activity = z.infer<typeof activitySchema>;

/** Result of grading one attempt. */
export interface Verdict {
  readonly correct: boolean;
  /** 0..1 contribution towards mastery (hints and retries reduce it). */
  readonly score: number;
  /** True when the answer earned partial credit rather than a clean pass. */
  readonly partial: boolean;
  /** Set when deterministic grading cannot decide and the AI evaluator is required. */
  readonly needsAi: boolean;
  readonly feedback?: {
    readonly yours: string;
    readonly better: string;
    readonly why: string;
  };
  /** Machine tags for the adaptive engine, e.g. `grammar:es-preterite`, `accent`. */
  readonly errorTags: readonly string[];
  /** Soft observations shown alongside a correct answer, e.g. "watch the accents". */
  readonly notes: readonly string[];
}

export function verdict(partialVerdict: Partial<Verdict> & Pick<Verdict, 'correct' | 'score'>): Verdict {
  return {
    partial: false,
    needsAi: false,
    errorTags: [],
    notes: [],
    ...partialVerdict,
  };
}
