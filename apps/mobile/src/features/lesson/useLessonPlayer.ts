import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ACTIVITY_REGISTRY,
  evaluateAnswer,
  lessonAccuracy,
  uuid,
  type Activity,
  type Verdict,
} from '@lingonest/core';
import { callFunction } from '@/services/api';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * The lesson state machine.
 *
 * Grading happens on the device first, which is what makes a lesson work on a
 * train with no signal. Only genuinely open production goes to the server, and
 * only when the deterministic pass says it cannot decide.
 */

export interface PlayerAttempt {
  readonly activityId: string;
  readonly verdict: Verdict;
  readonly answer: unknown;
  readonly hintsUsed: number;
  readonly attemptNumber: number;
  readonly responseMs: number;
  readonly points: number;
}

export type PlayerPhase = 'answering' | 'checking' | 'feedback' | 'complete';

interface UseLessonPlayerOptions {
  readonly activities: readonly Activity[];
  readonly lessonId: string;
  readonly languageCode: string;
  readonly variantCode: string | null;
}

export function useLessonPlayer({
  activities,
  lessonId,
  languageCode,
  variantCode,
}: UseLessonPlayerOptions) {
  const queueAttempt = useLearningStore((s) => s.queueAttempt);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<PlayerPhase>('answering');
  const [answer, setAnswer] = useState<unknown>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [revealedHints, setRevealedHints] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [attempts, setAttempts] = useState<PlayerAttempt[]>([]);

  const activityStartedAt = useRef(Date.now());
  const lessonStartedAt = useRef(Date.now());

  const activity = activities[index] ?? null;
  const isLast = index >= activities.length - 1;

  const progress = activities.length === 0 ? 0 : index / activities.length;

  const accuracy = useMemo(
    () => lessonAccuracy(attempts.map((a) => ({ score: a.verdict.score, points: a.points }))),
    [attempts],
  );

  const revealHint = useCallback(() => {
    if (!activity) return;
    setRevealedHints((count) => Math.min(count + 1, activity.hints.length));
  }, [activity]);

  const recordAttempt = useCallback(
    (currentActivity: Activity, finalVerdict: Verdict, submitted: unknown, hints: number, attemptNo: number) => {
      const responseMs = Date.now() - activityStartedAt.current;
      const record: PlayerAttempt = {
        activityId: currentActivity.id,
        verdict: finalVerdict,
        answer: submitted,
        hintsUsed: hints,
        attemptNumber: attemptNo,
        responseMs,
        points: currentActivity.points,
      };

      setAttempts((current) => [...current, record]);

      // Queued locally and synced later, so an offline lesson is not lost.
      queueAttempt({
        clientAttemptId: uuid(),
        lessonId,
        activityId: currentActivity.lessonId ? currentActivity.id : null,
        activityType: currentActivity.type,
        skill: currentActivity.skill,
        cefr: currentActivity.cefr,
        answer: submitted,
        isCorrect: finalVerdict.correct,
        score: finalVerdict.score,
        points: currentActivity.points,
        hintsUsed: hints,
        attemptNumber: attemptNo,
        responseMs,
        errorTags: finalVerdict.errorTags,
        at: Date.now(),
      });

      track('activity_completed', {
        activityType: currentActivity.type,
        skill: currentActivity.skill,
        cefr: currentActivity.cefr,
        correct: finalVerdict.correct,
        hintsUsed: hints,
        responseMs,
      });
    },
    [lessonId, queueAttempt],
  );

  const check = useCallback(
    async (submitted?: unknown) => {
      if (!activity || phase === 'checking') return;

      const value = submitted ?? answer;
      setPhase('checking');

      // 1. Deterministic grading, on the device.
      const local = evaluateAnswer(activity, value, {
        languageCode,
        cefr: activity.cefr,
        hintsUsed: revealedHints,
        attemptNumber,
      });

      // 2. Only genuinely open production goes to the server.
      if (local.needsAi && ACTIVITY_REGISTRY[activity.type].evaluation !== 'deterministic') {
        const text =
          typeof (value as { text?: string })?.text === 'string'
            ? (value as { text: string }).text
            : typeof (value as { transcript?: string })?.transcript === 'string'
              ? (value as { transcript: string }).transcript
              : '';

        const result = await callFunction<{
          correct: boolean;
          score: number;
          errors: { span: string; correction: string; type: string; explanation: string }[];
          better: string;
          why: string;
          strengths: string[];
        }>('ai-evaluate', {
          activityId: activity.lessonId ? activity.id : undefined,
          lessonId,
          languageCode,
          cefr: activity.cefr,
          skill:
            activity.skill === 'speaking' || activity.skill === 'pronunciation'
              ? 'speaking'
              : activity.skill === 'mediation'
                ? 'mediation'
                : activity.skill === 'interaction'
                  ? 'interaction'
                  : 'writing',
          task:
            (activity.prompt as { task?: string; question?: string; source?: string }).task ??
            (activity.prompt as { question?: string }).question ??
            (activity.prompt as { source?: string }).source ??
            '',
          answer: text,
          rubric: activity.rubric ?? {
            goal: 'Communicate the idea',
            criteria: ['The meaning is clear'],
          },
          reference: typeof activity.correctAnswer === 'string' ? activity.correctAnswer : undefined,
        });

        if (result.ok) {
          const aiVerdict: Verdict = {
            correct: result.value.correct,
            score: result.value.score,
            partial: !result.value.correct && result.value.score > 0,
            needsAi: false,
            errorTags: result.value.errors.map((e) => e.type),
            notes: result.value.strengths.map((s) => `strength:${s}`),
            feedback: { yours: text, better: result.value.better, why: result.value.why },
          };
          setVerdict(aiVerdict);
          setPhase('feedback');
          recordAttempt(activity, aiVerdict, value, revealedHints, attemptNumber);
          return;
        }

        // The AI is unavailable. Record the attempt as unscored rather than
        // marking the learner wrong for our outage.
        const unscored: Verdict = {
          correct: false,
          score: 0,
          partial: false,
          needsAi: false,
          errorTags: [],
          notes: ['unscored_ai_unavailable'],
          feedback: { yours: text, better: '', why: '' },
        };
        setVerdict(unscored);
        setPhase('feedback');
        recordAttempt(activity, unscored, value, revealedHints, attemptNumber);
        return;
      }

      setVerdict(local);
      setPhase('feedback');
      recordAttempt(activity, local, value, revealedHints, attemptNumber);
    },
    [activity, answer, phase, languageCode, revealedHints, attemptNumber, lessonId, recordAttempt],
  );

  /** Retry the same activity, which scores less but still teaches (brief §18). */
  const retry = useCallback(() => {
    setVerdict(null);
    setAnswer(null);
    setPhase('answering');
    setAttemptNumber((n) => n + 1);
    activityStartedAt.current = Date.now();
  }, []);

  const next = useCallback(() => {
    if (isLast) {
      setPhase('complete');
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setVerdict(null);
    setRevealedHints(0);
    setAttemptNumber(1);
    setPhase('answering');
    activityStartedAt.current = Date.now();
  }, [isLast]);

  const skip = useCallback(() => {
    if (!activity) return;
    const skipped: Verdict = {
      correct: false,
      score: 0,
      partial: false,
      needsAi: false,
      errorTags: ['skipped'],
      notes: ['skipped'],
    };
    recordAttempt(activity, skipped, null, revealedHints, attemptNumber);
    next();
  }, [activity, recordAttempt, revealedHints, attemptNumber, next]);

  return {
    activity,
    index,
    total: activities.length,
    progress,
    phase,
    verdict,
    revealedHints,
    attemptNumber,
    attempts,
    accuracy,
    durationMs: () => Date.now() - lessonStartedAt.current,
    isLast,
    setAnswer,
    check,
    retry,
    next,
    skip,
    revealHint,
    variantCode,
  };
}
