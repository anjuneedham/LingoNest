import { activitySchema, type Activity, type Cefr, type ContentStatus } from '@lingonest/core';
import { supabase } from './supabase';
import { query } from './api';

/**
 * The CMS data layer.
 *
 * Every write here goes through the same tables and triggers the seed pipeline
 * uses, so content authored in the app and content authored in the repository
 * are the same thing (§46: curriculum is data, never code). The workflow rules
 * — an AI draft needs a recorded human approval, a published lesson needs
 * activities and answer keys — are database triggers, so this layer reports
 * their errors rather than re-implementing them.
 */

export interface AdminLessonRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly ordinal: number;
  readonly cefr: Cefr;
  readonly status: ContentStatus;
  readonly generatedBy: 'human' | 'ai';
  readonly activityCount: number;
  readonly updatedAt: string;
}

export interface AdminUnitRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly objective: string;
  readonly ordinal: number;
  readonly status: ContentStatus;
  readonly lessons: readonly AdminLessonRow[];
}

export interface AdminCourseRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly ordinal: number;
  readonly status: ContentStatus;
  readonly cefr: Cefr;
  readonly units: readonly AdminUnitRow[];
}

interface CourseTreeRow {
  id: string;
  slug: string;
  title: string;
  ordinal: number;
  status: ContentStatus;
  levels: { cefr: Cefr };
  units: {
    id: string;
    slug: string;
    title: string;
    objective: string;
    ordinal: number;
    status: ContentStatus;
    lessons: {
      id: string;
      slug: string;
      title: string;
      ordinal: number;
      cefr: Cefr;
      status: ContentStatus;
      generated_by: 'human' | 'ai';
      updated_at: string;
      lesson_activities: { count: number }[];
    }[];
  }[];
}

/** The whole authoring tree for one language, drafts included. */
export async function fetchContentTree(languageCode: string) {
  return query<AdminCourseRow[]>(async () => {
    const { data, error } = await supabase
      .from('courses')
      .select(
        `id, slug, title, ordinal, status,
         levels!inner(cefr),
         languages!inner(code),
         units(id, slug, title, objective, ordinal, status,
               lessons(id, slug, title, ordinal, cefr, status, generated_by, updated_at,
                       lesson_activities(count)))`,
      )
      .eq('languages.code', languageCode)
      .order('ordinal');

    if (error) return { data: null, error };

    const shaped = ((data ?? []) as unknown as CourseTreeRow[]).map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      ordinal: course.ordinal,
      status: course.status,
      cefr: course.levels.cefr,
      units: (course.units ?? [])
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((unit) => ({
          id: unit.id,
          slug: unit.slug,
          title: unit.title,
          objective: unit.objective,
          ordinal: unit.ordinal,
          status: unit.status,
          lessons: (unit.lessons ?? [])
            .slice()
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((lesson) => ({
              id: lesson.id,
              slug: lesson.slug,
              title: lesson.title,
              ordinal: lesson.ordinal,
              cefr: lesson.cefr,
              status: lesson.status,
              generatedBy: lesson.generated_by,
              activityCount: lesson.lesson_activities?.[0]?.count ?? 0,
              updatedAt: lesson.updated_at,
            })),
        })),
    }));

    return { data: shaped, error: null };
  });
}

export interface AdminActivityRow {
  readonly id: string;
  readonly ordinal: number;
  readonly type: Activity['type'];
  readonly stage: Activity['stage'];
  readonly skill: Activity['skill'];
  readonly cefr: Cefr;
  readonly points: number;
  /** The row parsed into the runtime shape, or null when it fails validation. */
  readonly activity: Activity | null;
  readonly problems: readonly string[];
}

export interface AdminLessonDetail {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly objective: string;
  readonly canDo: string;
  readonly cefr: Cefr;
  readonly skills: readonly Activity['skill'][];
  readonly estimatedMinutes: number;
  readonly status: ContentStatus;
  readonly generatedBy: 'human' | 'ai';
  readonly unitTitle: string;
  readonly activities: readonly AdminActivityRow[];
  readonly approvals: readonly {
    id: string;
    fromStatus: ContentStatus | null;
    toStatus: ContentStatus;
    notes: string | null;
    createdAt: string;
    approvedByName: string | null;
  }[];
}

interface ActivityRow {
  id: string;
  ordinal: number;
  type: Activity['type'];
  stage: Activity['stage'];
  skill: Activity['skill'];
  cefr: Cefr;
  difficulty: number;
  prompt: unknown;
  correct_answer: unknown;
  acceptable_answers: unknown;
  hints: unknown;
  explanation: string | null;
  media: unknown;
  rubric: unknown;
  points: number;
  time_limit_seconds: number | null;
  tags: string[] | null;
  variants: string[] | null;
}

/** One lesson as the editor sees it: raw rows, each with its validation result. */
export async function fetchLessonForEditing(lessonId: string) {
  return query<AdminLessonDetail>(async () => {
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select(
        `id, slug, title, objective, can_do, cefr, skills, estimated_minutes, status, generated_by,
         units!inner(title),
         lesson_activities(id, ordinal, type, stage, skill, cefr, difficulty, prompt, correct_answer,
                           acceptable_answers, hints, explanation, media, rubric, points,
                           time_limit_seconds, tags, variants)`,
      )
      .eq('id', lessonId)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!lesson) return { data: null, error: null };

    const { data: approvals } = await supabase
      .from('content_approvals')
      .select('id, from_status, to_status, notes, created_at, profiles:approved_by(display_name)')
      .eq('entity_type', 'lesson')
      .eq('entity_id', lessonId)
      .order('created_at', { ascending: false });

    const rows = ((lesson.lesson_activities ?? []) as unknown as ActivityRow[])
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);

    const activities = rows.map((row) => {
      const parsed = activitySchema.safeParse(toActivityInput(row, lesson.id));
      return {
        id: row.id,
        ordinal: row.ordinal,
        type: row.type,
        stage: row.stage,
        skill: row.skill,
        cefr: row.cefr,
        points: row.points,
        activity: parsed.success ? parsed.data : null,
        problems: parsed.success
          ? []
          : parsed.error.issues.map((issue) => `${issue.path.join('.') || 'activity'}: ${issue.message}`),
      };
    });

    const unit = lesson.units as unknown as { title: string };

    return {
      data: {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        objective: lesson.objective,
        canDo: lesson.can_do,
        cefr: lesson.cefr as Cefr,
        skills: lesson.skills as Activity['skill'][],
        estimatedMinutes: lesson.estimated_minutes,
        status: lesson.status as ContentStatus,
        generatedBy: lesson.generated_by as 'human' | 'ai',
        unitTitle: unit?.title ?? '',
        activities,
        approvals: (approvals ?? []).map((row) => ({
          id: row.id,
          fromStatus: row.from_status as ContentStatus | null,
          toStatus: row.to_status as ContentStatus,
          notes: row.notes,
          createdAt: row.created_at,
          approvedByName:
            (row.profiles as unknown as { display_name: string } | null)?.display_name ?? null,
        })),
      },
      error: null,
    };
  });
}

function toActivityInput(row: ActivityRow, lessonId: string) {
  return {
    id: row.id,
    lessonId,
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
  };
}

/** Parses an editor draft without saving it, so the preview can render it. */
export function parseDraftActivity(draft: Record<string, unknown>, lessonId: string) {
  return activitySchema.safeParse(toActivityInput(draft as unknown as ActivityRow, lessonId));
}

export type WorkflowTarget = Extract<ContentStatus, 'draft' | 'in_review' | 'approved' | 'published' | 'archived'>;

/**
 * Moves a lesson through the workflow.
 *
 * The approval row is written first: for AI-drafted content the publish trigger
 * looks for exactly that row, so recording the human decision is what unlocks
 * publication rather than a flag the UI sets on its own (§47).
 */
export async function moveLessonStatus(
  lessonId: string,
  from: ContentStatus,
  to: WorkflowTarget,
  notes?: string,
) {
  const { data: userData } = await supabase.auth.getUser();
  const approver = userData.user?.id ?? null;

  return query(async () => {
    const { error: approvalError } = await supabase.from('content_approvals').insert({
      entity_type: 'lesson',
      entity_id: lessonId,
      from_status: from,
      to_status: to,
      approved_by: approver,
      notes: notes ?? null,
    });
    if (approvalError) return { data: null, error: approvalError };

    const { data, error } = await supabase
      .from('lessons')
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq('id', lessonId)
      .select('id, status')
      .maybeSingle();

    return { data: data ?? null, error };
  });
}

export interface AdminOverview {
  readonly lessonsByStatus: Record<string, number>;
  readonly aiDraftsAwaitingReview: number;
  readonly teacherApplicationsPending: number;
  readonly openReports: number;
  readonly publishedActivities: number;
}

/** The dashboard counts, each one a real query rather than a placeholder. */
export async function fetchAdminOverview() {
  return query<AdminOverview>(async () => {
    const statuses: ContentStatus[] = ['draft', 'in_review', 'approved', 'published', 'archived'];

    const counts = await Promise.all(
      statuses.map(async (status) => {
        const { count } = await supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        return [status, count ?? 0] as const;
      }),
    );

    const [{ count: aiDrafts }, { count: applications }, { count: reports }, { count: activities }] =
      await Promise.all([
        supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('generated_by', 'ai')
          .in('status', ['draft', 'in_review']),
        supabase
          .from('teacher_applications')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'under_review']),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('state', 'open'),
        supabase.from('lesson_activities').select('id', { count: 'exact', head: true }),
      ]);

    return {
      data: {
        lessonsByStatus: Object.fromEntries(counts),
        aiDraftsAwaitingReview: aiDrafts ?? 0,
        teacherApplicationsPending: applications ?? 0,
        openReports: reports ?? 0,
        publishedActivities: activities ?? 0,
      },
      error: null,
    };
  });
}

export interface ReviewQueueItem {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: ContentStatus;
  readonly generatedBy: 'human' | 'ai';
  readonly updatedAt: string;
  readonly unitTitle: string;
}

/** Everything waiting on a human decision. */
export async function fetchReviewQueue() {
  return query<ReviewQueueItem[]>(async () => {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, title, slug, status, generated_by, updated_at, units!inner(title)')
      .in('status', ['in_review', 'approved'])
      .order('updated_at', { ascending: true })
      .limit(100);

    if (error) return { data: null, error };

    return {
      data: (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status as ContentStatus,
        generatedBy: row.generated_by as 'human' | 'ai',
        updatedAt: row.updated_at,
        unitTitle: (row.units as unknown as { title: string }).title,
      })),
      error: null,
    };
  });
}

export interface ConfigRow {
  readonly key: string;
  readonly value: unknown;
  readonly isPublic: boolean;
  readonly updatedAt: string | null;
}

export async function fetchRemoteConfigRows() {
  return query<ConfigRow[]>(async () => {
    const { data, error } = await supabase
      .from('remote_config')
      .select('key, value, is_public, updated_at')
      .order('key');
    if (error) return { data: null, error };
    return {
      data: (data ?? []).map((row) => ({
        key: row.key,
        value: row.value,
        isPublic: row.is_public,
        updatedAt: row.updated_at,
      })),
      error: null,
    };
  });
}

export interface FlagRow {
  readonly key: string;
  readonly enabled: boolean;
  readonly description: string | null;
}

export async function fetchFeatureFlags() {
  return query<FlagRow[]>(async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled, description')
      .order('key');
    if (error) return { data: null, error };
    return { data: (data ?? []) as FlagRow[], error: null };
  });
}

export async function setFeatureFlag(key: string, enabled: boolean) {
  const { data: userData } = await supabase.auth.getUser();
  return query(async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .update({ enabled, updated_by: userData.user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select('key, enabled')
      .maybeSingle();
    return { data: data ?? null, error };
  });
}
