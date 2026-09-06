import { supabase } from './supabase';
import { useLearningStore, type QueuedAttempt } from '@/store/learning';

/**
 * Offline attempt sync.
 *
 * Activities are graded on the device, so a learner can work through a lesson
 * on a train with no signal. Attempts queue locally and replay when the app
 * comes back — safely, because each attempt carries a client-minted id and the
 * database upserts on it.
 */

const SYNC_INTERVAL_MS = 30_000;
const BATCH_SIZE = 50;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function syncPendingAttempts(): Promise<{ synced: number; failed: number }> {
  if (running) return { synced: 0, failed: 0 };
  running = true;

  try {
    const { pendingAttempts, clearAttempts } = useLearningStore.getState();
    if (pendingAttempts.length === 0) return { synced: 0, failed: 0 };

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { synced: 0, failed: 0 };
    const userId = sessionData.session.user.id;

    const batch = pendingAttempts.slice(0, BATCH_SIZE);

    const { error } = await supabase.from('activity_attempts').upsert(
      batch.map((attempt: QueuedAttempt) => ({
        user_id: userId,
        activity_id: attempt.activityId,
        lesson_id: attempt.lessonId,
        activity_type: attempt.activityType,
        skill: attempt.skill,
        cefr: attempt.cefr,
        client_attempt_id: attempt.clientAttemptId,
        answer: attempt.answer,
        is_correct: attempt.isCorrect,
        score: attempt.score,
        points: attempt.points,
        hints_used: attempt.hintsUsed,
        attempt_number: attempt.attemptNumber,
        response_ms: attempt.responseMs,
        error_tags: attempt.errorTags,
        created_at: new Date(attempt.at).toISOString(),
      })),
      { onConflict: 'user_id,client_attempt_id', ignoreDuplicates: true },
    );

    if (error) return { synced: 0, failed: batch.length };

    clearAttempts(batch.map((a) => a.clientAttemptId));
    return { synced: batch.length, failed: 0 };
  } finally {
    running = false;
  }
}

/** Starts the background sync loop. Returns a stop function. */
export function startAttemptSync(): () => void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void syncPendingAttempts();
  }, SYNC_INTERVAL_MS);

  void syncPendingAttempts();

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

export function pendingAttemptCount(): number {
  return useLearningStore.getState().pendingAttempts.length;
}
