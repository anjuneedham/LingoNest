import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SRS_SETTINGS,
  buildReviewQueue,
  gradeFromOutcome,
  reviewCard,
  type RecallGrade,
  type SrsCard,
} from '@lingonest/core';
import { Button, Card, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { supabase } from '@/services/supabase';
import { speak } from '@/services/audio';
import { speechTagFor } from '@/services/speech';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * The spaced-repetition review session.
 *
 * Scheduling is computed on the device by @lingonest/core, so a session works
 * offline and the interval logic is the unit-tested one. The results are
 * written back in a single call when the session ends.
 */
export default function Review() {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);
  const variantCode = useLearningStore((s) => s.variantCode);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<{ id: string; card: SrsCard; correct: boolean }[]>([]);
  const [startedAt] = useState(Date.now());
  const [itemStartedAt, setItemStartedAt] = useState(Date.now());
  const [saving, setSaving] = useState(false);

  const dueQuery = useQuery({
    queryKey: ['due-reviews', languageCode],
    queryFn: async () => {
      const { data } = await supabase.rpc('due_reviews', {
        p_language_code: languageCode!,
        p_limit: 30,
      });
      return (data ?? []) as DueRow[];
    },
    enabled: Boolean(languageCode && profile?.id),
    staleTime: 0,
  });

  const queue = useMemo(() => {
    const rows = dueQuery.data ?? [];
    return buildReviewQueue(
      rows.map((row) => ({
        item: row,
        card: {
          state: row.state,
          ease: Number(row.ease),
          intervalDays: Number(row.interval_days),
          repetitions: row.repetitions,
          lapses: row.lapses,
          step: row.step,
          dueAt: new Date(row.due_at).getTime(),
          lastReviewedAt: null,
        },
      })),
      { limit: 30, newCardLimit: 8 },
    );
  }, [dueQuery.data]);

  const current = queue[index];
  const finished = index >= queue.length && queue.length > 0;

  const save = useCallback(
    async (finalResults: typeof results) => {
      setSaving(true);
      await supabase.rpc('record_reviews', {
        p_reviews: finalResults.map((entry) => ({
          vocabularyId: entry.id,
          state: entry.card.state,
          ease: entry.card.ease,
          intervalDays: entry.card.intervalDays,
          repetitions: entry.card.repetitions,
          lapses: entry.card.lapses,
          step: entry.card.step,
          dueAt: entry.card.dueAt,
          correct: entry.correct,
        })),
      });

      track('review_session_completed', {
        itemCount: finalResults.length,
        accuracy:
          finalResults.length === 0
            ? 0
            : finalResults.filter((r) => r.correct).length / finalResults.length,
        durationMs: Date.now() - startedAt,
      });
      setSaving(false);
    },
    [startedAt],
  );

  const grade = (quality: RecallGrade) => {
    if (!current) return;

    const responseMs = Date.now() - itemStartedAt;
    const derived = gradeFromOutcome({
      correct: quality !== 'again',
      responseMs,
      baselineMs: current.item.avg_response_ms ?? undefined,
    });

    // The learner's own assessment wins; timing only refines "good".
    const finalGrade: RecallGrade = quality === 'good' ? derived : quality;

    const nextCard = reviewCard(current.card, { grade: finalGrade, responseMs }, DEFAULT_SRS_SETTINGS);
    const nextResults = [
      ...results,
      { id: current.item.vocabulary_id, card: nextCard, correct: finalGrade !== 'again' },
    ];
    setResults(nextResults);
    setRevealed(false);
    setItemStartedAt(Date.now());
    setIndex((i) => i + 1);

    if (index + 1 >= queue.length) void save(nextResults);
  };

  if (dueQuery.isLoading) return <Screen loading />;

  if (queue.length === 0) {
    return (
      <Screen
        empty={{
          title: t('practice.noneDue'),
          actionLabel: t('common.back'),
          onAction: () => router.back(),
        }}
      />
    );
  }

  if (finished) {
    const correct = results.filter((r) => r.correct).length;
    return (
      <Screen>
        <Text variant="title" align="center" style={{ marginTop: spacing.xxl }}>
          {t('practice.reviewComplete')}
        </Text>
        <Text variant="heading" align="center" color="primary" style={{ marginTop: spacing.md }}>
          {t('practice.reviewSummary', { correct, total: results.length })}
        </Text>
        <Button
          label={t('common.done')}
          onPress={() => router.back()}
          loading={saving}
          fullWidth
          size="large"
          style={{ marginTop: spacing.xxl }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ProgressBar value={index / queue.length} style={{ marginBottom: spacing.xl }} />

      <Pressable onPress={() => setRevealed(true)} style={{ flex: 1 }} accessibilityRole="button">
        <Card style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="target" targetLanguage={languageCode ?? undefined} align="center">
            {current?.item.term}
          </Text>

          {revealed ? (
            <>
              <View
                style={{
                  height: 1,
                  alignSelf: 'stretch',
                  backgroundColor: theme.border,
                  marginVertical: spacing.lg,
                }}
              />
              <Text variant="heading" align="center">
                {current?.item.translation}
              </Text>
              {current?.item.example_sentence ? (
                <Text
                  variant="small"
                  color="muted"
                  align="center"
                  targetLanguage={languageCode ?? undefined}
                  style={{ marginTop: spacing.md }}
                >
                  {current.item.example_sentence}
                </Text>
              ) : null}
              <Button
                label={t('activity.playModel')}
                onPress={() =>
                  void speak(current!.item.term, speechTagFor(languageCode ?? 'es', variantCode))
                }
                variant="ghost"
                size="small"
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : (
            <Text variant="caption" color="muted" style={{ marginTop: spacing.xl }}>
              {t('practice.showAnswer')}
            </Text>
          )}
        </Card>
      </Pressable>

      {revealed ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          {(['again', 'hard', 'good', 'easy'] as const).map((quality) => (
            <Pressable
              key={quality}
              onPress={() => grade(quality)}
              accessibilityRole="button"
              accessibilityLabel={t(`practice.${quality}`)}
              style={{
                flex: 1,
                minHeight: MIN_TOUCH_TARGET + 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor:
                  quality === 'again'
                    ? theme.dangerMuted
                    : quality === 'easy'
                      ? theme.successMuted
                      : theme.surface,
              }}
            >
              <Text variant="small">{t(`practice.${quality}`)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Button
          label={t('practice.showAnswer')}
          onPress={() => setRevealed(true)}
          fullWidth
          size="large"
          style={{ marginTop: spacing.lg }}
        />
      )}
    </Screen>
  );
}

interface DueRow {
  vocabulary_id: string;
  term: string;
  translation: string;
  example_sentence: string | null;
  audio_asset_key: string | null;
  cefr: string;
  state: SrsCard['state'];
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  step: number;
  due_at: string;
  avg_response_ms?: number | null;
}
