import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The lesson summary.
 *
 * Says what improved and what to do next, rather than only celebrating. The
 * mistakes are grouped by what they were about — a grammar point, a word — so
 * "review this" means something specific.
 */
export default function LessonSummary() {
  const { lessonId, accuracy, durationMs } = useLocalSearchParams<{
    lessonId: string;
    accuracy?: string;
    durationMs?: string;
  }>();
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();

  const accuracyValue = Number(accuracy ?? 0);
  const minutes = Math.max(1, Math.round(Number(durationMs ?? 0) / 60_000));

  const tone = useMemo(() => {
    if (accuracyValue >= 0.9) return theme.success;
    if (accuracyValue >= 0.7) return theme.primary;
    return theme.warning;
  }, [accuracyValue, theme]);

  return (
    <Screen>
      <Text variant="title" align="center" style={{ marginTop: spacing.xl }}>
        {t('lesson.summaryTitle')}
      </Text>

      <Card style={{ marginTop: spacing.xl }}>
        <Text variant="caption" color="muted">
          {t('lesson.accuracy')}
        </Text>
        <Text variant="display" style={{ color: tone, marginTop: spacing.xs }}>
          {`${Math.round(accuracyValue * 100)}%`}
        </Text>
        <ProgressBar value={accuracyValue} color={tone} style={{ marginTop: spacing.md }} />

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <Badge label={t('lesson.timeSpent')} glyph="◷" />
          <Badge label={t('common.minutes', { count: minutes })} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color="muted">
          {t('lesson.nextStep')}
        </Text>
        <Text variant="body" style={{ marginTop: spacing.sm }}>
          {accuracyValue >= 0.8
            ? t('recommend.next.reason', { objective: t('learn.notStarted') })
            : t('practice.mistakesBody')}
        </Text>
      </Card>

      <Button
        label={t('lesson.continue')}
        onPress={() => router.replace('/(tabs)')}
        fullWidth
        size="large"
        style={{ marginTop: spacing.xxl }}
      />

      {accuracyValue < 0.8 ? (
        <Button
          label={t('lesson.practiceThis')}
          onPress={() => router.replace('/practice/mistakes')}
          variant="secondary"
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </Screen>
  );
}
