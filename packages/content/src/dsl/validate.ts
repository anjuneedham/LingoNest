import {
  ACTIVITY_REGISTRY,
  cefrDistance,
  promptSchemaFor,
  type ActivityType,
} from '@lingonest/core';
import type { AuthoredCurriculum } from './types';
import { compileCourse, type CompiledCourse, type CompiledLesson } from './compile';

/**
 * Semantic validation, beyond what the type system and the Zod schemas catch.
 *
 * This is what stops thin or ambiguous content reaching learners (brief §87):
 * every published lesson must have an objective, a CEFR level, skills, answer
 * keys, an explanation for anything gradable, mutually exclusive multiple
 * choice options, licensed audio and references that actually resolve.
 */

export interface ValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly where: string;
  readonly message: string;
}

export interface ValidationReport {
  readonly issues: readonly ValidationIssue[];
  readonly errors: number;
  readonly warnings: number;
  readonly stats: {
    readonly courses: number;
    readonly units: number;
    readonly lessons: number;
    readonly activities: number;
    readonly vocabulary: number;
    readonly grammar: number;
    readonly scenarios: number;
    readonly activityTypesUsed: number;
  };
}

/** Activity types that need a rubric rather than an answer key. */
const OPEN_PRODUCTION: ReadonlySet<ActivityType> = new Set([
  'conversation',
  'roleplay',
  'scenario_simulation',
  'speech_response',
  'written_response',
]);

/**
 * Types that carry their answer inside the prompt rather than in a separate
 * answer key: a pronunciation target, a timed challenge's item list, a
 * flashcard's two sides, a review set drawn at runtime.
 */
const ANSWER_IN_PROMPT: ReadonlySet<ActivityType> = new Set([
  'flashcard',
  'review_challenge',
  'timed_challenge',
  'pronunciation_repeat',
  'word_match',
]);

/** Types with nothing to explain when the learner gets it wrong. */
const NO_EXPLANATION_NEEDED: ReadonlySet<ActivityType> = new Set([
  'flashcard',
  'review_challenge',
  'timed_challenge',
  'pronunciation_repeat',
  'word_match',
  'image_match',
]);

export function validateCurriculum(curriculum: AuthoredCurriculum): ValidationReport {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], where: string, message: string) =>
    issues.push({ severity, where, message });

  const vocabularyKeys = new Set(curriculum.vocabulary.map((v) => v.key));
  const grammarKeys = new Set(curriculum.grammar.map((g) => g.key));
  const cultureKeys = new Set(curriculum.culture.map((c) => c.key));
  const scenarioKeys = new Set(curriculum.scenarios.map((s) => s.key));
  const mediaKeys = new Set(curriculum.media.map((m) => m.key));
  const licensedMedia = new Set(
    curriculum.media.filter((m) => m.licence && m.licence !== 'unknown').map((m) => m.key),
  );

  const seenLessonSlugs = new Set<string>();
  const usedVocabulary = new Set<string>();
  const usedActivityTypes = new Set<string>();

  let unitCount = 0;
  let lessonCount = 0;
  let activityCount = 0;

  const compiled: CompiledCourse[] = curriculum.courses.map((c, index) =>
    compileCourse(c, { languageCode: curriculum.languageCode, ordinal: index + 1 }),
  );

  for (const course of compiled) {
    if (course.units.length === 0) add('error', course.slug, 'course has no units');

    for (const unit of course.units) {
      unitCount += 1;
      if (unit.lessons.length === 0) add('error', unit.slug, 'unit has no lessons');
      if (!unit.realWorldTask) {
        add('warning', unit.slug, 'unit has no real-world task');
      }

      const hasReviewLesson = unit.lessons.some((l) => l.isReview || l.isCheckpoint);
      if (unit.lessons.length >= 4 && !hasReviewLesson) {
        add('warning', unit.slug, 'unit of four or more lessons has no review lesson');
      }

      for (const lesson of unit.lessons) {
        lessonCount += 1;
        activityCount += lesson.activities.length;
        for (const a of lesson.activities) usedActivityTypes.add(a.type);

        if (seenLessonSlugs.has(lesson.slug)) {
          add('error', lesson.slug, 'duplicate lesson slug');
        }
        seenLessonSlugs.add(lesson.slug);

        validateLesson(lesson, {
          add,
          vocabularyKeys,
          grammarKeys,
          cultureKeys,
          scenarioKeys,
          mediaKeys,
          licensedMedia,
          usedVocabulary,
        });
      }
    }
  }

  // Vocabulary that no lesson ever teaches is dead weight in the catalogue.
  for (const item of curriculum.vocabulary) {
    if (!usedVocabulary.has(item.key)) {
      add('warning', `vocabulary:${item.key}`, 'vocabulary item is not used by any lesson');
    }
  }

  for (const scenario of curriculum.scenarios) {
    for (const key of scenario.vocabulary ?? []) {
      if (!vocabularyKeys.has(key)) {
        add('error', `scenario:${scenario.key}`, `references unknown vocabulary "${key}"`);
      }
    }
  }

  for (const media of curriculum.media) {
    if (!media.licence || media.licence === 'unknown') {
      add('error', `media:${media.key}`, 'media asset has no licence; it cannot back published content');
    }
  }

  return {
    issues,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    stats: {
      courses: compiled.length,
      units: unitCount,
      lessons: lessonCount,
      activities: activityCount,
      vocabulary: curriculum.vocabulary.length,
      grammar: curriculum.grammar.length,
      scenarios: curriculum.scenarios.length,
      activityTypesUsed: usedActivityTypes.size,
    },
  };
}

interface LessonContext {
  add: (severity: ValidationIssue['severity'], where: string, message: string) => void;
  vocabularyKeys: ReadonlySet<string>;
  grammarKeys: ReadonlySet<string>;
  cultureKeys: ReadonlySet<string>;
  scenarioKeys: ReadonlySet<string>;
  mediaKeys: ReadonlySet<string>;
  licensedMedia: ReadonlySet<string>;
  usedVocabulary: Set<string>;
}

function validateLesson(lesson: CompiledLesson, ctx: LessonContext): void {
  const where = lesson.slug;
  const { add } = ctx;

  if (!lesson.objective.trim()) add('error', where, 'lesson has no objective');
  if (!lesson.canDo.trim()) add('error', where, 'lesson has no can-do statement');
  if (lesson.minutes < 1 || lesson.minutes > 120) {
    add('error', where, `lesson duration of ${lesson.minutes} minutes is implausible`);
  }
  if (lesson.skills.length === 0) add('error', where, 'lesson trains no skill');
  if (lesson.activities.length < 3 && !lesson.isCheckpoint) {
    add('error', where, `lesson has only ${lesson.activities.length} activities; three is the minimum`);
  }

  for (const key of lesson.vocabulary ?? []) {
    if (!ctx.vocabularyKeys.has(key)) {
      add('error', where, `references unknown vocabulary "${key}"`);
    }
    ctx.usedVocabulary.add(key);
  }
  for (const key of lesson.grammar ?? []) {
    if (!ctx.grammarKeys.has(key)) add('error', where, `references unknown grammar topic "${key}"`);
  }
  for (const key of lesson.culture ?? []) {
    if (!ctx.cultureKeys.has(key)) add('error', where, `references unknown culture note "${key}"`);
  }

  for (const activity of lesson.activities) {
    const at = `${where}#${activity.ordinal} (${activity.type})`;
    const def = ACTIVITY_REGISTRY[activity.type];

    const prompt = promptSchemaFor(activity.type).safeParse(activity.prompt);
    if (!prompt.success) {
      add('error', at, `prompt does not match the schema: ${prompt.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }

    // Answer key or rubric, depending on how the type is graded.
    if (OPEN_PRODUCTION.has(activity.type)) {
      if (!activity.rubric) add('error', at, 'open-ended activity has no rubric');
      else if (activity.rubric.criteria.length === 0) add('error', at, 'rubric has no criteria');
    } else if (!ANSWER_IN_PROMPT.has(activity.type)) {
      if (activity.correctAnswer === undefined || activity.correctAnswer === null) {
        add('error', at, 'gradable activity has no answer key');
      }
    }

    // Anything the learner can get wrong should be able to say why.
    if (
      !NO_EXPLANATION_NEEDED.has(activity.type) &&
      !OPEN_PRODUCTION.has(activity.type) &&
      !activity.explanation
    ) {
      add('warning', at, 'no explanation, so a wrong answer cannot be explained');
    }

    // Multiple choice options must be mutually exclusive and distinct.
    if (activity.type === 'multiple_choice' || activity.type === 'tap_translation' || activity.type === 'audio_recognition') {
      const opts = (prompt.data as { options: { id: string; text: string }[] }).options;
      const texts = opts.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) {
        add('error', at, 'options are not distinct, so more than one could be correct');
      }
      if (opts.length < 2) add('error', at, 'needs at least two options');
      const answerId = typeof activity.correctAnswer === 'string' ? activity.correctAnswer : undefined;
      if (answerId && !opts.some((o) => o.id === answerId)) {
        add('error', at, 'the answer key does not match any option');
      }
    }

    if (activity.type === 'multiple_answer') {
      const answers = Array.isArray(activity.correctAnswer) ? activity.correctAnswer : [];
      if (answers.length < 2) add('warning', at, 'a multiple-answer item with one answer should be multiple choice');
    }

    if (activity.type === 'sentence_order') {
      const tokens = (prompt.data as { tokens: string[] }).tokens;
      const answer = Array.isArray(activity.correctAnswer) ? (activity.correctAnswer as string[]) : [];
      if (answer.length !== tokens.length) {
        add('error', at, `answer has ${answer.length} tokens but ${tokens.length} were provided`);
      }
      const sortedTokens = [...tokens].sort().join('|');
      const sortedAnswer = [...answer].sort().join('|');
      if (sortedTokens !== sortedAnswer) {
        add('error', at, 'the answer uses words that are not in the token set');
      }
    }

    if (activity.type === 'fill_blank') {
      const template = (prompt.data as { template: string }).template;
      const blanks = (template.match(/\{\{blank\}\}/g) ?? []).length;
      const answers = Array.isArray(activity.correctAnswer) ? activity.correctAnswer.length : 0;
      if (blanks === 0) add('error', at, 'template has no {{blank}} marker');
      if (blanks !== answers) add('error', at, `template has ${blanks} blanks but ${answers} answers`);
    }

    if (activity.type === 'word_categorization') {
      const categories = new Set((prompt.data as { categories: string[] }).categories);
      const mapping = (activity.correctAnswer ?? {}) as Record<string, string>;
      for (const [word, category] of Object.entries(mapping)) {
        if (!categories.has(category)) {
          add('error', at, `"${word}" is mapped to unknown category "${category}"`);
        }
      }
    }

    if (activity.type === 'conversation' || activity.type === 'roleplay') {
      const key = (prompt.data as { scenarioKey: string }).scenarioKey;
      if (!ctx.scenarioKeys.has(key)) add('error', at, `references unknown scenario "${key}"`);
    }

    if (activity.type === 'flashcard') {
      const key = (prompt.data as { vocabularyId: string }).vocabularyId;
      if (!ctx.vocabularyKeys.has(key)) add('error', at, `references unknown vocabulary "${key}"`);
      ctx.usedVocabulary.add(key);
    }

    // Media must exist and be licensed.
    for (const media of activity.media) {
      if (!ctx.mediaKeys.has(media.assetKey)) {
        add('error', at, `references unknown media asset "${media.assetKey}"`);
      } else if (!ctx.licensedMedia.has(media.assetKey)) {
        add('error', at, `references unlicensed media asset "${media.assetKey}"`);
      }
    }
    if (def.requiresAudio && !activity.media.some((m) => m.kind === 'audio')) {
      add('error', at, 'this activity type needs audio but none is attached');
    }
    if (activity.type === 'pronunciation_repeat' && !activity.media.some((m) => m.kind === 'audio')) {
      // Not fatal: the player falls back to the device speech synthesiser, but a
      // recorded model is better and an author should know it is missing.
      add('warning', at, 'no recorded model audio; the device speech synthesiser will be used');
    }

    // Hints must be ordered and end with the answer.
    if (activity.hints.length > 0) {
      const levels = activity.hints.map((h) => h.level);
      const sorted = [...levels].sort((a, b) => a - b);
      if (levels.join() !== sorted.join()) add('error', at, 'hints are not in order');
      if (new Set(levels).size !== levels.length) add('error', at, 'hints have duplicate levels');
    }

    // Activities should be within one band of the lesson's level.
    if (cefrDistance(activity.cefr, lesson.cefr) > 1) {
      add('warning', at, `activity is ${activity.cefr} in a ${lesson.cefr} lesson`);
    }
  }

  // A lesson that only ever asks the learner to tap is not this product.
  const interactive = lesson.activities.filter(
    (a) => a.type !== 'flashcard' && a.type !== 'word_match',
  );
  if (interactive.length === 0 && !lesson.isReview) {
    add('warning', where, 'lesson has no productive activity — the learner only recognises, never produces');
  }
}
