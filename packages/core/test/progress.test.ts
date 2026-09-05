import { describe, expect, it } from 'vitest';
import {
  checkpointVerdict,
  evaluateLevelReadiness,
  lessonAccuracy,
  type LevelStats,
} from '../src/progress/mastery';
import {
  daysBetweenIso,
  goalMet,
  isMeaningfulSession,
  newlyEarnedAchievements,
  recordStreakDay,
  streakBonus,
  streakIsAlive,
  type StreakState,
} from '../src/progress/gamification';

const perfectStats: LevelStats = {
  lessonsTotal: 50,
  lessonsCompleted: 50,
  vocabularyTotal: 300,
  vocabularyMastered: 260,
  accuracy: 0.88,
  accuracyBySkill: { listening: 0.85, speaking: 0.8, reading: 0.9, writing: 0.8 },
  checkpointScore: 0.86,
  speakingTasksCompleted: 20,
  activeDays: 15,
};

describe('level readiness', () => {
  it('unlocks the next level when every criterion is met', () => {
    const readiness = evaluateLevelReadiness('A1', perfectStats);
    expect(readiness.ready).toBe(true);
    expect(readiness.unmet).toHaveLength(0);
  });

  it('does not unlock on lesson completion alone', () => {
    const readiness = evaluateLevelReadiness('A1', {
      ...perfectStats,
      accuracy: 0.4,
      checkpointScore: 0.3,
      vocabularyMastered: 30,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.unmet.map((u) => u.criterion)).toContain('accuracy');
    expect(readiness.unmet.map((u) => u.criterion)).toContain('checkpoint');
  });

  it('explains exactly what is missing rather than showing a bare padlock', () => {
    const readiness = evaluateLevelReadiness('A1', { ...perfectStats, speakingTasksCompleted: 1 });
    const speaking = readiness.unmet.find((u) => u.criterion === 'speakingTasks');
    expect(speaking).toBeDefined();
    expect(speaking?.required).toBe(8);
    expect(speaking?.actual).toBe(1);
    expect(speaking?.messageKey).toBe('progress.unmet.speaking');
  });

  it('requires consistency, not cramming', () => {
    const crammed = evaluateLevelReadiness('A1', { ...perfectStats, activeDays: 2 });
    expect(crammed.ready).toBe(false);
    expect(crammed.unmet.map((u) => u.criterion)).toContain('activeDays');
  });

  it('holds a level back when one skill lags', () => {
    const readiness = evaluateLevelReadiness('A1', {
      ...perfectStats,
      accuracyBySkill: { ...perfectStats.accuracyBySkill, speaking: 0.2 },
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.unmet.map((u) => u.criterion)).toContain('skill:speaking');
  });

  it('reports partial progress for the progress bar', () => {
    const readiness = evaluateLevelReadiness('A1', { ...perfectStats, lessonsCompleted: 25 });
    expect(readiness.progress).toBeGreaterThan(0.5);
    expect(readiness.progress).toBeLessThan(1);
  });

  it('tightens the criteria as levels rise', () => {
    const stats = { ...perfectStats, accuracy: 0.76, checkpointScore: 0.76 };
    expect(evaluateLevelReadiness('A1', stats).unmet.map((u) => u.criterion)).not.toContain('accuracy');
    expect(evaluateLevelReadiness('B2', stats).unmet.map((u) => u.criterion)).toContain('accuracy');
  });

  it('labels checkpoint outcomes without claiming certification', () => {
    expect(checkpointVerdict(0.95)).toBe('strong');
    expect(checkpointVerdict(0.8)).toBe('solid');
    expect(checkpointVerdict(0.65)).toBe('developing');
    expect(checkpointVerdict(0.3)).toBe('not_yet');
  });

  it('weights lesson accuracy by activity points', () => {
    expect(lessonAccuracy([{ score: 1, points: 30 }, { score: 0, points: 10 }])).toBe(0.75);
    expect(lessonAccuracy([])).toBe(0);
  });
});

describe('streaks', () => {
  const base: StreakState = { current: 4, longest: 9, lastActiveDate: '2026-03-10', freezesAvailable: 1 };

  it('counts calendar days between ISO dates', () => {
    expect(daysBetweenIso('2026-03-10', '2026-03-11')).toBe(1);
    expect(daysBetweenIso('2026-02-28', '2026-03-01')).toBe(1); // 2026 is not a leap year
  });

  it('extends on a consecutive day', () => {
    expect(recordStreakDay(base, '2026-03-11').current).toBe(5);
  });

  it('is idempotent within the same day', () => {
    expect(recordStreakDay(base, '2026-03-10')).toBe(base);
  });

  it('resets after a missed day', () => {
    expect(recordStreakDay(base, '2026-03-13').current).toBe(1);
  });

  it('can spend a freeze to cover a single missed day', () => {
    const result = recordStreakDay(base, '2026-03-12', { useFreeze: true });
    expect(result.current).toBe(5);
    expect(result.freezesAvailable).toBe(0);
  });

  it('will not spend a freeze the learner does not have', () => {
    const noFreezes = { ...base, freezesAvailable: 0 };
    expect(recordStreakDay(noFreezes, '2026-03-12', { useFreeze: true }).current).toBe(1);
  });

  it('starts a streak for a first-time learner', () => {
    const fresh: StreakState = { current: 0, longest: 0, lastActiveDate: null, freezesAvailable: 0 };
    expect(recordStreakDay(fresh, '2026-03-10').current).toBe(1);
  });

  it('tracks the longest streak', () => {
    const state = recordStreakDay({ ...base, current: 9, longest: 9 }, '2026-03-11');
    expect(state.longest).toBe(10);
  });

  it('reports whether the streak is still alive today', () => {
    expect(streakIsAlive(base, '2026-03-11')).toBe(true);
    expect(streakIsAlive(base, '2026-03-13')).toBe(false);
  });

  it('caps the streak bonus so it cannot dwarf real practice', () => {
    expect(streakBonus(2)).toBe(0);
    expect(streakBonus(3)).toBe(5);
    expect(streakBonus(3650)).toBe(50);
  });
});

describe('meaningful sessions', () => {
  const empty = { activeMinutes: 0, scoredAttempts: 0, lessonsCompleted: 0, aiTurns: 0, tutorMinutes: 0 };

  it('does not count merely opening the app', () => {
    expect(isMeaningfulSession({ ...empty, activeMinutes: 2, scoredAttempts: 1 })).toBe(false);
  });

  it('counts a completed lesson', () => {
    expect(isMeaningfulSession({ ...empty, lessonsCompleted: 1 })).toBe(true);
  });

  it('counts sustained practice', () => {
    expect(isMeaningfulSession({ ...empty, activeMinutes: 6, scoredAttempts: 10 })).toBe(true);
  });

  it('counts a real AI conversation and a tutored lesson', () => {
    expect(isMeaningfulSession({ ...empty, aiTurns: 6 })).toBe(true);
    expect(isMeaningfulSession({ ...empty, tutorMinutes: 30 })).toBe(true);
  });
});

describe('goals and achievements', () => {
  it('detects a met goal', () => {
    expect(goalMet({ targetMinutes: 15, minutesDone: 15, lessonsDone: 1, reviewsDone: 0 })).toBe(true);
    expect(goalMet({ targetMinutes: 15, minutesDone: 14, lessonsDone: 1, reviewsDone: 0 })).toBe(false);
  });

  it('awards achievements once and only once', () => {
    const stats = {
      lessonsCompleted: 10,
      wordsMastered: 120,
      streakDays: 8,
      aiConversations: 2,
      tutorLessons: 0,
      levelsCompleted: 0,
      speakingTasks: 3,
      perfectLessons: 0,
    };
    const first = newlyEarnedAchievements(stats, []);
    expect(first).toContain('ten_lessons');
    expect(first).toContain('hundred_words');
    expect(first).toContain('week_streak');
    expect(newlyEarnedAchievements(stats, first)).toEqual([]);
  });
});
