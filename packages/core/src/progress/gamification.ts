/**
 * XP, streaks, goals and achievements (brief §41).
 *
 * Gamification exists to bring the learner back, not to describe their ability.
 * Nothing here feeds level progression — that is `mastery.ts`.
 */

export interface XpEvent {
  readonly source:
    | 'activity_correct'
    | 'activity_attempt'
    | 'lesson_complete'
    | 'review_complete'
    | 'ai_practice'
    | 'daily_goal'
    | 'streak_bonus'
    | 'checkpoint'
    | 'tutor_lesson';
  readonly amount: number;
  readonly at: number;
}

export const XP_VALUES = {
  activity_correct: 10,
  activity_attempt: 2,
  lesson_complete: 25,
  review_complete: 15,
  ai_practice: 20,
  daily_goal: 30,
  checkpoint: 100,
  tutor_lesson: 60,
} as const;

/** Streak bonus is capped so a long streak cannot dwarf actual practice. */
export function streakBonus(streakDays: number): number {
  if (streakDays < 3) return 0;
  return Math.min(50, 5 * Math.floor(streakDays / 3));
}

export interface StreakState {
  readonly current: number;
  readonly longest: number;
  /** ISO date (YYYY-MM-DD) in the learner's own timezone. */
  readonly lastActiveDate: string | null;
  readonly freezesAvailable: number;
}

/** Days between two ISO dates, treating them as calendar days. */
export function daysBetweenIso(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Advance the streak for a day of meaningful practice.
 *
 * The learner's *local* date is the unit, passed in by the caller, so someone
 * practising at 23:50 in Tokyo is not penalised by UTC.
 */
export function recordStreakDay(
  state: StreakState,
  todayIso: string,
  options: { useFreeze?: boolean } = {},
): StreakState {
  if (state.lastActiveDate === todayIso) return state;
  if (state.lastActiveDate === null) {
    return { ...state, current: 1, longest: Math.max(1, state.longest), lastActiveDate: todayIso };
  }

  const gap = daysBetweenIso(state.lastActiveDate, todayIso);
  if (gap <= 0) return state; // clock skew or a repeated submission

  if (gap === 1) {
    const current = state.current + 1;
    return { ...state, current, longest: Math.max(current, state.longest), lastActiveDate: todayIso };
  }

  // A single missed day can be covered by a freeze if the learner has one.
  if (gap === 2 && options.useFreeze && state.freezesAvailable > 0) {
    const current = state.current + 1;
    return {
      current,
      longest: Math.max(current, state.longest),
      lastActiveDate: todayIso,
      freezesAvailable: state.freezesAvailable - 1,
    };
  }

  return { ...state, current: 1, lastActiveDate: todayIso };
}

/** Whether the streak is still alive as of `todayIso` (without new practice). */
export function streakIsAlive(state: StreakState, todayIso: string): boolean {
  if (!state.lastActiveDate) return false;
  return daysBetweenIso(state.lastActiveDate, todayIso) <= 1;
}

export interface DailyGoal {
  readonly targetMinutes: number;
  readonly minutesDone: number;
  readonly lessonsDone: number;
  readonly reviewsDone: number;
}

export function goalProgress(goal: DailyGoal): number {
  if (goal.targetMinutes <= 0) return 1;
  return Math.min(1, Math.round((goal.minutesDone / goal.targetMinutes) * 1000) / 1000);
}

export function goalMet(goal: DailyGoal): boolean {
  return goal.minutesDone >= goal.targetMinutes;
}

/**
 * A "meaningful session" — the primary retention metric (brief §71).
 * Deliberately harder to satisfy than "opened the app".
 */
export interface SessionSignals {
  readonly activeMinutes: number;
  readonly scoredAttempts: number;
  readonly lessonsCompleted: number;
  readonly aiTurns: number;
  readonly tutorMinutes: number;
}

export function isMeaningfulSession(s: SessionSignals): boolean {
  if (s.lessonsCompleted >= 1) return true;
  if (s.tutorMinutes >= 15) return true;
  if (s.aiTurns >= 6) return true;
  return s.activeMinutes >= 5 && s.scoredAttempts >= 8;
}

export interface AchievementRule {
  readonly code: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  readonly lessonsCompleted: number;
  readonly wordsMastered: number;
  readonly streakDays: number;
  readonly aiConversations: number;
  readonly tutorLessons: number;
  readonly levelsCompleted: number;
  readonly speakingTasks: number;
  readonly perfectLessons: number;
}

export const ACHIEVEMENTS: readonly AchievementRule[] = [
  { code: 'first_lesson', labelKey: 'achievement.first_lesson', descriptionKey: 'achievement.first_lesson.desc', check: (s) => s.lessonsCompleted >= 1 },
  { code: 'ten_lessons', labelKey: 'achievement.ten_lessons', descriptionKey: 'achievement.ten_lessons.desc', check: (s) => s.lessonsCompleted >= 10 },
  { code: 'fifty_lessons', labelKey: 'achievement.fifty_lessons', descriptionKey: 'achievement.fifty_lessons.desc', check: (s) => s.lessonsCompleted >= 50 },
  { code: 'hundred_words', labelKey: 'achievement.hundred_words', descriptionKey: 'achievement.hundred_words.desc', check: (s) => s.wordsMastered >= 100 },
  { code: 'five_hundred_words', labelKey: 'achievement.five_hundred_words', descriptionKey: 'achievement.five_hundred_words.desc', check: (s) => s.wordsMastered >= 500 },
  { code: 'week_streak', labelKey: 'achievement.week_streak', descriptionKey: 'achievement.week_streak.desc', check: (s) => s.streakDays >= 7 },
  { code: 'month_streak', labelKey: 'achievement.month_streak', descriptionKey: 'achievement.month_streak.desc', check: (s) => s.streakDays >= 30 },
  { code: 'first_conversation', labelKey: 'achievement.first_conversation', descriptionKey: 'achievement.first_conversation.desc', check: (s) => s.aiConversations >= 1 },
  { code: 'first_tutor_lesson', labelKey: 'achievement.first_tutor_lesson', descriptionKey: 'achievement.first_tutor_lesson.desc', check: (s) => s.tutorLessons >= 1 },
  { code: 'level_complete', labelKey: 'achievement.level_complete', descriptionKey: 'achievement.level_complete.desc', check: (s) => s.levelsCompleted >= 1 },
  { code: 'speaker', labelKey: 'achievement.speaker', descriptionKey: 'achievement.speaker.desc', check: (s) => s.speakingTasks >= 25 },
  { code: 'perfectionist', labelKey: 'achievement.perfectionist', descriptionKey: 'achievement.perfectionist.desc', check: (s) => s.perfectLessons >= 5 },
];

export function newlyEarnedAchievements(stats: AchievementStats, already: readonly string[]): string[] {
  const have = new Set(already);
  return ACHIEVEMENTS.filter((a) => !have.has(a.code) && a.check(stats)).map((a) => a.code);
}
