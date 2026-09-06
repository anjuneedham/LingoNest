import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_REGISTRY } from '@lingonest/core';
import { Button, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchLesson, completeLesson } from '@/services/content';
import { useLessonPlayer } from '@/features/lesson/useLessonPlayer';
import { FeedbackPanel } from '@/features/lesson/FeedbackPanel';
import { HintButton } from '@/features/lesson/HintButton';
import { rendererFor } from '@/features/lesson/activities';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * The lesson player.
 *
 * The header always says where the learner is (unit → lesson, stage, progress),
 * because getting lost mid-lesson is the failure the brief names first (§96).
 */
export default function LessonPlayer() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();

  const languageCode = useLearningStore((s) => s.languageCode) ?? 'es';
  const variantCode = useLearningStore((s) => s.variantCode);
  const [submitting, setSubmitting] = useState(false);

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchLesson(lessonId),
    enabled: Boolean(lessonId),
  });

  const result = lessonQuery.data;
  const lesson = result?.ok ? result.value : null;

  const player = useLessonPlayer({
    activities: lesson?.activities ?? [],
    lessonId: lessonId ?? '',
    languageCode,
    variantCode,
  });

  const finish = useCallback(async () => {
    if (!lesson || submitting) return;
    setSubmitting(true);

    const localDate = new Date().toISOString().slice(0, 10);
    const durationMs = player.durationMs();

    await completeLesson({
      lessonId: lesson.id,
      attempts: player.attempts.map((attempt) => ({
        clientAttemptId: `${lesson.id}-${attempt.activityId}-${attempt.attemptNumber}`,
        activityId: attempt.activityId,
        activityType:
          lesson.activities.find((a) => a.id === attempt.activityId)?.type ?? 'multiple_choice',
        skill: lesson.activities.find((a) => a.id === attempt.activityId)?.skill ?? 'vocabulary',
        cefr: lesson.cefr,
        isCorrect: attempt.verdict.correct,
        score: attempt.verdict.score,
        points: attempt.points,
        hintsUsed: attempt.hintsUsed,
        attemptNumber: attempt.attemptNumber,
        responseMs: attempt.responseMs,
        errorTags: attempt.verdict.errorTags,
        answer: attempt.answer,
      })),
      durationMs,
      localDate,
    });

    track('lesson_completed', {
      lessonId: lesson.id,
      cefr: lesson.cefr,
      accuracy: player.accuracy,
      durationMs,
      xp: 0,
    });

    router.replace({
      pathname: '/lesson/[lessonId]/summary',
      params: { lessonId: lesson.id, accuracy: String(player.accuracy), durationMs: String(durationMs) },
    });
  }, [lesson, player, submitting]);

  useEffect(() => {
    if (player.phase === 'complete') void finish();
  }, [player.phase, finish]);

  const confirmExit = () => {
    Alert.alert(t('lesson.exitTitle'), t('lesson.exitBody'), [
      { text: t('lesson.exitStay'), style: 'cancel' },
      {
        text: t('lesson.exitConfirm'),
        style: 'destructive',
        onPress: () => {
          if (lesson) {
            track('lesson_abandoned', { lessonId: lesson.id, atActivityIndex: player.index });
          }
          router.back();
        },
      },
    ]);
  };

  if (lessonQuery.isLoading || !lesson) {
    return (
      <Screen
        loading={lessonQuery.isLoading}
        error={result && !result.ok ? result.error : null}
        onRetry={() => void lessonQuery.refetch()}
      />
    );
  }

  if (lesson.activities.length === 0) {
    return (
      <Screen
        empty={{
          title: t('error.content_unavailable'),
          actionLabel: t('common.back'),
          onAction: () => router.back(),
        }}
      />
    );
  }

  const activity = player.activity;
  const Renderer = activity ? rendererFor(activity.type) : null;
  const definition = activity ? ACTIVITY_REGISTRY[activity.type] : null;
  // Types where a tap is the whole answer submit themselves; the rest need a
  // deliberate "check".
  const autoSubmits =
    activity?.type === 'multiple_choice' ||
    activity?.type === 'tap_translation' ||
    activity?.type === 'image_match' ||
    activity?.type === 'audio_recognition' ||
    activity?.type === 'flashcard' ||
    activity?.type === 'dialogue_completion';

  const estimatedTimePerActivity = 45; // seconds
  const estimatedRemainingSeconds = (lesson.activities.length - player.index - 1) * estimatedTimePerActivity;
  const estimatedRemainingMinutes = Math.ceil(estimatedRemainingSeconds / 60);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Button label={t('common.close')} onPress={confirmExit} variant="ghost" size="small" />
          <View style={{ flex: 1, marginHorizontal: spacing.md }}>
            <ProgressBar value={player.progress} height={6} />
          </View>
          <Text variant="caption" color="muted">
            {`${player.index + 1}/${player.total}`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="muted">
              {`${lesson.unitTitle} · ${lesson.title}`}
            </Text>
            {activity ? (
              <Text variant="caption" color="primary" style={{ marginTop: spacing.xs, fontWeight: '600' }}>
                {t(`lesson.stage.${activity.stage}`)}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" color="muted" style={{ textAlign: 'right' }}>
            {estimatedRemainingMinutes > 0 ? `~${estimatedRemainingMinutes}m left` : 'Almost done!'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        {activity && Renderer ? (
          <Renderer
            activity={activity}
            languageCode={languageCode}
            variantCode={variantCode}
            onAnswerChange={player.setAnswer}
            onSubmit={autoSubmits ? (value) => void player.check(value) : undefined}
            verdict={player.verdict}
            revealedHints={player.revealedHints}
            disabled={player.phase !== 'answering'}
          />
        ) : null}

        {activity && definition?.supportsHints && player.phase === 'answering' ? (
          <HintButton
            hints={activity.hints}
            revealed={player.revealedHints}
            onReveal={player.revealHint}
          />
        ) : null}
      </ScrollView>

      <View
        style={{
          padding: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        {player.phase === 'feedback' && player.verdict ? (
          <FeedbackPanel
            verdict={player.verdict}
            languageCode={languageCode}
            canRetry={player.attemptNumber < 3}
            onRetry={player.retry}
            onContinue={player.next}
          />
        ) : (
          <Button
            label={player.phase === 'checking' ? t('lesson.checkingAnswer') : t('lesson.check')}
            onPress={() => void player.check()}
            loading={player.phase === 'checking'}
            disabled={autoSubmits}
            fullWidth
            size="large"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
