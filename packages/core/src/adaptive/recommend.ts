import type { Cefr } from '../cefr/levels';
import type { Skill } from '../skills/skills';
import type { SkillProfile } from '../skills/estimate';
import { laggingSkills } from '../skills/estimate';

/**
 * Turns what we know about a learner into a ranked list of things to do next,
 * each with a reason the learner can read (brief §19, §96).
 */

export interface MistakeSignal {
  /** Machine tag: `grammar:es-preterite`, `vocab:restaurante`, `phoneme:rr`. */
  readonly tag: string;
  readonly skill: Skill;
  readonly count: number;
  /** Epoch ms of the most recent occurrence. */
  readonly lastSeenAt: number;
  /** Human-readable label for the tag, supplied by content. */
  readonly label: string;
  /** Where to send the learner to fix it. */
  readonly target?: RecommendationTarget;
}

export interface RecommendationTarget {
  readonly kind: 'lesson' | 'grammar' | 'review' | 'speaking' | 'listening' | 'writing' | 'conversation' | 'quick';
  readonly id?: string;
}

export interface RecommendationInput {
  readonly profile: SkillProfile;
  readonly mistakes: readonly MistakeSignal[];
  readonly dueVocabularyCount: number;
  readonly leechCount: number;
  /** Lesson the learner is partway through, if any. */
  readonly inProgressLesson?: { id: string; title: string; objective: string; minutes: number };
  /** Next unstarted lesson on the path. */
  readonly nextLesson?: { id: string; title: string; objective: string; minutes: number };
  /** Days since the learner last practised. */
  readonly daysSinceLastPractice: number;
  /** Minutes remaining against today's goal. */
  readonly minutesRemainingToday: number;
  /** Assignments set by a human teacher — these outrank the algorithm. */
  readonly teacherAssignments?: readonly {
    id: string;
    kind: RecommendationTarget['kind'];
    targetId?: string;
    title: string;
    teacherName: string;
    dueAt?: number;
  }[];
  readonly cefr: Cefr;
  readonly now?: number;
}

export interface Recommendation {
  readonly id: string;
  readonly kind: RecommendationTarget['kind'];
  readonly targetId?: string;
  readonly titleKey: string;
  readonly titleParams: Record<string, string | number>;
  /** Why this is being suggested, in the learner's language. */
  readonly reasonKey: string;
  readonly reasonParams: Record<string, string | number>;
  readonly estimatedMinutes: number;
  /** Higher sorts first. */
  readonly priority: number;
  readonly skill?: Skill;
}

const RECENCY_WINDOW_DAYS = 14;

/**
 * Rank what to do next. The ordering rationale:
 *  1. a teacher's assignment — a human made a deliberate decision;
 *  2. overdue review — forgetting is the fastest way to lose progress;
 *  3. leeches — words that keep failing need re-teaching, not more drilling;
 *  4. repeated recent mistakes — the clearest signal of a real gap;
 *  5. finishing what was started;
 *  6. the lagging skill;
 *  7. the next lesson on the path.
 */
export function recommendNext(input: RecommendationInput): Recommendation[] {
  const now = input.now ?? Date.now();
  const out: Recommendation[] = [];

  for (const assignment of input.teacherAssignments ?? []) {
    out.push({
      id: `assignment:${assignment.id}`,
      kind: assignment.kind,
      targetId: assignment.targetId,
      titleKey: 'recommend.assignment.title',
      titleParams: { title: assignment.title },
      reasonKey: 'recommend.assignment.reason',
      reasonParams: { teacher: assignment.teacherName },
      estimatedMinutes: 10,
      priority: 100,
    });
  }

  if (input.dueVocabularyCount > 0) {
    out.push({
      id: 'review:due',
      kind: 'review',
      titleKey: 'recommend.review.title',
      titleParams: { count: input.dueVocabularyCount },
      reasonKey: 'recommend.review.reason',
      reasonParams: { count: input.dueVocabularyCount },
      estimatedMinutes: Math.max(2, Math.min(15, Math.ceil(input.dueVocabularyCount * 0.25))),
      priority: 90 + Math.min(9, input.dueVocabularyCount / 10),
      skill: 'vocabulary',
    });
  }

  if (input.leechCount > 0) {
    out.push({
      id: 'review:leeches',
      kind: 'review',
      targetId: 'leeches',
      titleKey: 'recommend.leech.title',
      titleParams: { count: input.leechCount },
      reasonKey: 'recommend.leech.reason',
      reasonParams: { count: input.leechCount },
      estimatedMinutes: 5,
      priority: 88,
      skill: 'vocabulary',
    });
  }

  const recentMistakes = [...input.mistakes]
    .filter((m) => (now - m.lastSeenAt) / 86_400_000 <= RECENCY_WINDOW_DAYS && m.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt)
    .slice(0, 3);

  recentMistakes.forEach((mistake, index) => {
    out.push({
      id: `mistake:${mistake.tag}`,
      kind: mistake.target?.kind ?? 'grammar',
      targetId: mistake.target?.id,
      titleKey: 'recommend.mistake.title',
      titleParams: { topic: mistake.label },
      reasonKey: 'recommend.mistake.reason',
      reasonParams: { topic: mistake.label, count: mistake.count },
      estimatedMinutes: 5,
      priority: 80 - index,
      skill: mistake.skill,
    });
  });

  if (input.inProgressLesson) {
    out.push({
      id: `lesson:${input.inProgressLesson.id}`,
      kind: 'lesson',
      targetId: input.inProgressLesson.id,
      titleKey: 'recommend.continue.title',
      titleParams: { title: input.inProgressLesson.title },
      reasonKey: 'recommend.continue.reason',
      reasonParams: { objective: input.inProgressLesson.objective },
      estimatedMinutes: input.inProgressLesson.minutes,
      priority: 75,
    });
  }

  const lagging = laggingSkills(input.profile);
  const skillTarget: Partial<Record<Skill, RecommendationTarget['kind']>> = {
    speaking: 'speaking',
    listening: 'listening',
    writing: 'writing',
    interaction: 'conversation',
    pronunciation: 'speaking',
    vocabulary: 'review',
    grammar: 'grammar',
    reading: 'lesson',
    mediation: 'writing',
  };
  lagging.slice(0, 2).forEach((skill, index) => {
    const kind = skillTarget[skill] ?? 'quick';
    out.push({
      id: `skill:${skill}`,
      kind,
      titleKey: `recommend.skill.${skill}.title`,
      titleParams: {},
      reasonKey: 'recommend.skill.reason',
      reasonParams: { skill },
      estimatedMinutes: 8,
      priority: 65 - index,
      skill,
    });
  });

  if (input.nextLesson) {
    out.push({
      id: `lesson:${input.nextLesson.id}`,
      kind: 'lesson',
      targetId: input.nextLesson.id,
      titleKey: 'recommend.next.title',
      titleParams: { title: input.nextLesson.title },
      reasonKey: 'recommend.next.reason',
      reasonParams: { objective: input.nextLesson.objective },
      estimatedMinutes: input.nextLesson.minutes,
      priority: 60,
    });
  }

  if (input.daysSinceLastPractice >= 3) {
    out.push({
      id: 'quick:comeback',
      kind: 'quick',
      titleKey: 'recommend.quick.title',
      titleParams: { minutes: 5 },
      reasonKey: 'recommend.quick.reason.comeback',
      reasonParams: { days: input.daysSinceLastPractice },
      estimatedMinutes: 5,
      priority: 85,
    });
  } else if (input.minutesRemainingToday > 0 && input.minutesRemainingToday <= 5) {
    out.push({
      id: 'quick:finish_goal',
      kind: 'quick',
      titleKey: 'recommend.quick.title',
      titleParams: { minutes: input.minutesRemainingToday },
      reasonKey: 'recommend.quick.reason.goal',
      reasonParams: { minutes: input.minutesRemainingToday },
      estimatedMinutes: input.minutesRemainingToday,
      priority: 70,
    });
  }

  // Deduplicate by target, keeping the highest-priority entry.
  const seen = new Map<string, Recommendation>();
  for (const rec of out.sort((a, b) => b.priority - a.priority)) {
    const key = `${rec.kind}:${rec.targetId ?? ''}`;
    if (!seen.has(key)) seen.set(key, rec);
  }
  return [...seen.values()].sort((a, b) => b.priority - a.priority);
}

/**
 * What a human teacher should focus on next, derived from the same signals
 * (brief §33). Returned as structured data so the teacher UI can render it and
 * the AI teacher assistant can draft a plan from it.
 */
export interface TeacherFocus {
  readonly area: string;
  readonly skill: Skill;
  readonly evidence: string;
  readonly suggestedActivity: string;
  readonly priority: number;
}

export function suggestTeacherFocus(input: {
  profile: SkillProfile;
  mistakes: readonly MistakeSignal[];
  dueVocabularyCount: number;
  now?: number;
}): TeacherFocus[] {
  const now = input.now ?? Date.now();
  const focuses: TeacherFocus[] = [];

  const topMistakes = [...input.mistakes]
    .filter((m) => (now - m.lastSeenAt) / 86_400_000 <= 30)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  topMistakes.forEach((m, i) => {
    focuses.push({
      area: m.label,
      skill: m.skill,
      evidence: `${m.count} recent errors`,
      suggestedActivity:
        m.skill === 'speaking' || m.skill === 'interaction'
          ? `Role-play drilling ${m.label}`
          : `Targeted practice and correction on ${m.label}`,
      priority: 90 - i * 5,
    });
  });

  for (const skill of laggingSkills(input.profile).slice(0, 2)) {
    focuses.push({
      area: `${skill} development`,
      skill,
      evidence: `${skill} is below the learner's overall estimated level`,
      suggestedActivity:
        skill === 'listening'
          ? 'Graded listening with comprehension questions'
          : skill === 'writing'
            ? 'Short guided writing with correction'
            : `Extended ${skill} practice`,
      priority: 70,
    });
  }

  if (input.dueVocabularyCount > 30) {
    focuses.push({
      area: 'Vocabulary backlog',
      skill: 'vocabulary',
      evidence: `${input.dueVocabularyCount} words overdue for review`,
      suggestedActivity: 'Use the backlog words in conversation rather than drilling them',
      priority: 60,
    });
  }

  return focuses.sort((a, b) => b.priority - a.priority);
}
