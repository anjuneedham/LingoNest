import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKey, type Cefr, type Skill } from '@lingonest/core';

/**
 * The learner's current language context, kept locally so the app opens
 * instantly and works offline. Authoritative values come from the server; this
 * is the last-known state plus the queue of work waiting to sync.
 */

export interface QueuedAttempt {
  readonly clientAttemptId: string;
  readonly lessonId: string;
  readonly activityId: string | null;
  readonly activityType: string;
  readonly skill: Skill;
  readonly cefr: Cefr;
  readonly answer: unknown;
  readonly isCorrect: boolean;
  readonly score: number;
  readonly points: number;
  readonly hintsUsed: number;
  readonly attemptNumber: number;
  readonly responseMs: number;
  readonly errorTags: readonly string[];
  readonly at: number;
}

interface LearningState {
  languageCode: string | null;
  variantCode: string | null;
  /** Last-known level estimate, for instant render before the server responds. */
  cachedLevels: Partial<Record<Skill | 'overall', Cefr | null>>;
  dailyGoalMinutes: number;
  immersionPercent: number;
  /** Attempts recorded while offline, replayed on reconnect. */
  pendingAttempts: QueuedAttempt[];
  setLanguage: (languageCode: string, variantCode: string | null) => void;
  setCachedLevels: (levels: Partial<Record<Skill | 'overall', Cefr | null>>) => void;
  setDailyGoal: (minutes: number) => void;
  setImmersion: (percent: number) => void;
  queueAttempt: (attempt: QueuedAttempt) => void;
  clearAttempts: (ids: readonly string[]) => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set) => ({
      languageCode: null,
      variantCode: null,
      cachedLevels: {},
      dailyGoalMinutes: 15,
      immersionPercent: 0,
      pendingAttempts: [],

      setLanguage: (languageCode, variantCode) => set({ languageCode, variantCode }),
      setCachedLevels: (cachedLevels) => set({ cachedLevels }),
      setDailyGoal: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
      setImmersion: (immersionPercent) => set({ immersionPercent }),

      queueAttempt: (attempt) =>
        set((state) => {
          // The client id makes this idempotent: re-queueing the same attempt
          // after a failed sync cannot double-count it.
          if (state.pendingAttempts.some((a) => a.clientAttemptId === attempt.clientAttemptId)) {
            return state;
          }
          return { pendingAttempts: [...state.pendingAttempts, attempt] };
        }),

      clearAttempts: (ids) =>
        set((state) => ({
          pendingAttempts: state.pendingAttempts.filter((a) => !ids.includes(a.clientAttemptId)),
        })),
    }),
    {
      name: storageKey('learning'),
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
