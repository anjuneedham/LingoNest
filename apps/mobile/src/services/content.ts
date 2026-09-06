import { activitySchema, type Activity, type Cefr, type Skill } from '@lingonest/core';
import { supabase } from './supabase';
import { query } from './api';

/**
 * Reads curriculum from the API.
 *
 * RLS already restricts these tables to published rows for a learner, so these
 * queries do not filter by status themselves — the database is the authority,
 * not a `.eq('status', 'published')` the client could drop.
 */

export interface LessonSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly objective: string;
  readonly canDo: string;
  readonly cefr: Cefr;
  readonly skills: readonly Skill[];
  readonly estimatedMinutes: number;
  readonly isReview: boolean;
  readonly isCheckpoint: boolean;
  readonly ordinal: number;
  readonly status: 'not_started' | 'in_progress' | 'completed';
  readonly bestScore: number;
}

export interface UnitSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly objective: string;
  readonly realWorldTask: string | null;
  readonly cefr: Cefr;
  readonly ordinal: number;
  readonly lessons: readonly LessonSummary[];
}

export interface CourseSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly cefr: Cefr;
  readonly ordinal: number;
  readonly units: readonly UnitSummary[];
}

export interface LessonDetail {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly canDo: string;
  readonly cefr: Cefr;
  readonly estimatedMinutes: number;
  readonly unitTitle: string;
  readonly activities: readonly Activity[];
  readonly vocabulary: readonly { id: string; term: string; translation: string; audio: string | null }[];
}

/** The whole path for a language, with the learner's progress folded in. */
export async function fetchCurriculum(languageCode: string, userId: string) {
  return query(async () => {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(
        `id, slug, title, description, ordinal,
         levels!inner(cefr),
         languages!inner(code),
         units(id, slug, title, objective, real_world_task, cefr, ordinal,
               lessons(id, slug, title, objective, can_do, cefr, skills, estimated_minutes, is_review, is_checkpoint, ordinal))`,
      )
      .eq('languages.code', languageCode)
      .order('ordinal');

    if (error) return { data: null, error };

    const { data: progress } = await supabase
      .from('user_progress')
      .select('lesson_id, status, best_score')
      .eq('user_id', userId);

    const progressByLesson = new Map(
      (progress ?? []).map((row) => [row.lesson_id, { status: row.status, bestScore: row.best_score }]),
    );

    const shaped: CourseSummary[] = (courses ?? []).map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      cefr: (course.levels as unknown as { cefr: Cefr }).cefr,
      ordinal: course.ordinal,
      units: ((course.units ?? []) as unknown as UnitRow[])
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((unit) => ({
          id: unit.id,
          slug: unit.slug,
          title: unit.title,
          objective: unit.objective,
          realWorldTask: unit.real_world_task,
          cefr: unit.cefr,
          ordinal: unit.ordinal,
          lessons: (unit.lessons ?? [])
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((lesson) => {
              const entry = progressByLesson.get(lesson.id);
              return {
                id: lesson.id,
                slug: lesson.slug,
                title: lesson.title,
                objective: lesson.objective,
                canDo: lesson.can_do,
                cefr: lesson.cefr,
                skills: lesson.skills,
                estimatedMinutes: lesson.estimated_minutes,
                isReview: lesson.is_review,
                isCheckpoint: lesson.is_checkpoint,
                ordinal: lesson.ordinal,
                status: (entry?.status ?? 'not_started') as LessonSummary['status'],
                bestScore: entry?.bestScore ?? 0,
              };
            }),
        })),
    }));

    return { data: shaped, error: null };
  });
}

interface UnitRow {
  id: string;
  slug: string;
  title: string;
  objective: string;
  real_world_task: string | null;
  cefr: Cefr;
  ordinal: number;
  lessons: {
    id: string;
    slug: string;
    title: string;
    objective: string;
    can_do: string;
    cefr: Cefr;
    skills: Skill[];
    estimated_minutes: number;
    is_review: boolean;
    is_checkpoint: boolean;
    ordinal: number;
  }[];
}

/** One lesson, with its activities parsed and validated before rendering. */
export async function fetchLesson(lessonId: string) {
  return query<LessonDetail>(async () => {
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select(
        `id, title, objective, can_do, cefr, estimated_minutes,
         units!inner(title),
         lesson_activities(id, ordinal, type, stage, skill, cefr, difficulty, prompt, correct_answer,
                           acceptable_answers, hints, explanation, media, rubric, points,
                           time_limit_seconds, tags, variants),
         lesson_vocabulary(vocabulary_items(id, term, translation, audio_asset_key))`,
      )
      .eq('id', lessonId)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!lesson) return { data: null, error: null };

    const rows = ((lesson.lesson_activities ?? []) as ActivityRow[]).sort((a, b) => a.ordinal - b.ordinal);

    // Parse each activity through the shared schema. A malformed row is skipped
    // rather than crashing the lesson — content bugs should degrade, not break.
    const activities: Activity[] = [];
    for (const row of rows) {
      const parsed = activitySchema.safeParse({
        id: row.id,
        lessonId: lesson.id,
        type: row.type,
        ordinal: row.ordinal,
        stage: row.stage,
        skill: row.skill,
        cefr: row.cefr,
        difficulty: row.difficulty,
        prompt: row.prompt,
        correctAnswer: row.correct_answer ?? undefined,
        acceptableAnswers: row.acceptable_answers ?? undefined,
        hints: row.hints ?? [],
        explanation: row.explanation ?? undefined,
        media: row.media ?? [],
        rubric: row.rubric ?? undefined,
        points: row.points,
        timeLimitSeconds: row.time_limit_seconds ?? undefined,
        tags: row.tags ?? [],
        variants: row.variants ?? [],
      });
      if (parsed.success) activities.push(parsed.data);
    }

    const vocabulary = ((lesson.lesson_vocabulary ?? []) as unknown as VocabularyLinkRow[])
      .flatMap((link) =>
        // PostgREST types an embedded relation as an array even when the
        // foreign key guarantees at most one row.
        Array.isArray(link.vocabulary_items) ? link.vocabulary_items : [link.vocabulary_items],
      )
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        term: item.term,
        translation: item.translation,
        audio: item.audio_asset_key,
      }));

    return {
      data: {
        id: lesson.id,
        title: lesson.title,
        objective: lesson.objective,
        canDo: lesson.can_do,
        cefr: lesson.cefr,
        estimatedMinutes: lesson.estimated_minutes,
        unitTitle: (lesson.units as unknown as { title: string }).title,
        activities,
        vocabulary,
      },
      error: null,
    };
  });
}

interface ActivityRow {
  id: string;
  ordinal: number;
  type: string;
  stage: string;
  skill: string;
  cefr: string;
  difficulty: number;
  prompt: unknown;
  correct_answer: unknown;
  acceptable_answers: unknown[] | null;
  hints: unknown[] | null;
  explanation: string | null;
  media: unknown[] | null;
  rubric: unknown;
  points: number;
  time_limit_seconds: number | null;
  tags: string[] | null;
  variants: string[] | null;
}

interface VocabularyLinkRow {
  vocabulary_items:
    | { id: string; term: string; translation: string; audio_asset_key: string | null }
    | { id: string; term: string; translation: string; audio_asset_key: string | null }[];
}

/** Records a completed lesson in one transaction. */
export async function completeLesson(input: {
  lessonId: string;
  attempts: readonly {
    clientAttemptId: string;
    activityId: string | null;
    activityType: string;
    skill: string;
    cefr: string;
    isCorrect: boolean;
    score: number;
    points: number;
    hintsUsed: number;
    attemptNumber: number;
    responseMs: number;
    errorTags: readonly string[];
    answer: unknown;
  }[];
  durationMs: number;
  /** The learner's own local date, so a late-night session counts for today. */
  localDate: string;
}) {
  return query<{ accuracy: number; xp: number; streak: number; newWords: number }>(async () => {
    const { data, error } = await supabase.rpc('complete_lesson', {
      p_lesson_id: input.lessonId,
      p_attempts: input.attempts,
      p_duration_ms: input.durationMs,
      p_local_date: input.localDate,
    });
    return { data: data as { accuracy: number; xp: number; streak: number; newWords: number }, error };
  });
}
