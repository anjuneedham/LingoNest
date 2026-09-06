import {
  ACTIVITY_REGISTRY,
  activitySchema,
  type Activity,
  type ActivityType,
  type Cefr,
  type Skill,
} from '@lingonest/core';
import type { AuthoredActivity, AuthoredCourse, AuthoredLesson, AuthoredUnit } from './types';

/**
 * Turn authored content into the strict runtime shape.
 *
 * Ordinals, ids, default stages, default skills and default point values are
 * filled in here so authors never write them, and the result is parsed with the
 * same schema the app uses at runtime.
 */

export interface CompiledActivity extends Activity {
  readonly lessonSlug: string;
}

export interface CompiledLesson extends Omit<AuthoredLesson, 'activities'> {
  readonly unitSlug: string;
  readonly courseSlug: string;
  readonly skills: readonly Skill[];
  readonly activities: readonly CompiledActivity[];
}

export interface CompiledUnit extends Omit<AuthoredUnit, 'lessons'> {
  readonly courseSlug: string;
  readonly ordinal: number;
  readonly lessons: readonly CompiledLesson[];
}

export interface CompiledCourse extends Omit<AuthoredCourse, 'units'> {
  readonly languageCode: string;
  readonly ordinal: number;
  readonly units: readonly CompiledUnit[];
}

export function compileActivity(
  authored: AuthoredActivity,
  context: { lessonSlug: string; ordinal: number; lessonCefr: Cefr },
): CompiledActivity {
  const def = ACTIVITY_REGISTRY[authored.type as ActivityType];
  if (!def) throw new Error(`Unknown activity type "${authored.type}" in ${context.lessonSlug}`);

  const parsed = activitySchema.parse({
    id: `${context.lessonSlug}-a${context.ordinal}`,
    type: authored.type,
    ordinal: context.ordinal,
    stage: authored.stage ?? def.stage,
    skill: authored.skill ?? def.skill,
    cefr: authored.cefr ?? context.lessonCefr,
    difficulty: authored.difficulty ?? 2,
    prompt: authored.prompt,
    correctAnswer: authored.correctAnswer,
    acceptableAnswers: authored.acceptableAnswers,
    hints: authored.hints ?? [],
    explanation: authored.explanation,
    media: authored.media ?? [],
    rubric: authored.rubric,
    points: authored.points ?? def.defaultPoints,
    timeLimitSeconds: authored.timeLimitSeconds,
    tags: authored.tags ?? [],
    variants: authored.variants ?? [],
  });

  return { ...parsed, lessonSlug: context.lessonSlug };
}

export function compileLesson(
  authored: AuthoredLesson,
  context: { unitSlug: string; courseSlug: string },
): CompiledLesson {
  const activities = authored.activities.map((activity, index) =>
    compileActivity(activity, {
      lessonSlug: authored.slug,
      ordinal: index + 1,
      lessonCefr: authored.cefr,
    }),
  );

  // A lesson's skills are derived from what it actually asks the learner to do,
  // unless the author states them explicitly.
  const skills = authored.skills ?? [...new Set(activities.map((a) => a.skill))];

  return {
    ...authored,
    unitSlug: context.unitSlug,
    courseSlug: context.courseSlug,
    skills,
    activities,
  };
}

export function compileUnit(
  authored: AuthoredUnit,
  context: { courseSlug: string; ordinal: number },
): CompiledUnit {
  return {
    ...authored,
    courseSlug: context.courseSlug,
    ordinal: context.ordinal,
    lessons: authored.lessons.map((l) =>
      compileLesson(l, { unitSlug: authored.slug, courseSlug: context.courseSlug }),
    ),
  };
}

export function compileCourse(
  authored: AuthoredCourse,
  context: { languageCode: string; ordinal: number },
): CompiledCourse {
  return {
    ...authored,
    languageCode: context.languageCode,
    ordinal: context.ordinal,
    units: authored.units.map((u, index) =>
      compileUnit(u, { courseSlug: authored.slug, ordinal: index + 1 }),
    ),
  };
}
