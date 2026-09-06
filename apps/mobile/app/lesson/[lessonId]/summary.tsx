import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, BounceIn } from 'react-native-reanimated';
import { Badge, Button, Card, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { feedbackLessonComplete } from '@/services/feedback';

/**
 * The lesson summary.
 *
 * Says what improved and what to do next, rather than only celebrating. The
 * mistakes are grouped by what they were about — a grammar point, a word — so
 * "review this" means something specific.
 */
export default function LessonSummary() {
  const { accuracy, durationMs } = useLocalSearchParams<{
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

  const isMastered = accuracyValue >= 0.9;
  const isGood = accuracyValue >= 0.8;
  const celebrationEmoji = isMastered ? '🏆' : isGood ? '✨' : '💪';
  const feedbackMessage = isMastered
    ? 'lesson.perfect'
    : isGood
      ? 'lesson.great'
      : 'lesson.keepGoing';

  useEffect(() => {
    feedbackLessonComplete();
  }, []);

  return (
    <Screen>
      <Animated.View entering={FadeInDown}>
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Animated.Text
            style={{ fontSize: 56, marginBottom: spacing.md }}
            entering={BounceIn.delay(200)}
          >
            {celebrationEmoji}
          </Animated.Text>
          <Text variant="display" align="center">
            {t('lesson.summaryTitle')}
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100)}>
        <Card style={{ marginTop: spacing.xl, borderColor: tone, borderWidth: 2 }}>
          <Text variant="caption" color="muted">
            {t('lesson.accuracy')}
          </Text>
          <Text variant="display" style={{ color: tone, marginTop: spacing.xs }}>
            {`${Math.round(accuracyValue * 100)}%`}
          </Text>
          <ProgressBar value={accuracyValue} color={tone} style={{ marginTop: spacing.md }} />

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginTop: spacing.lg,
              flexWrap: 'wrap',
            }}
          >
            <Badge label={t(feedbackMessage) || 'Great work!'} tone="primary" />
            <Badge label={t('lesson.timeSpent')} glyph="⏱" />
            <Badge label={t('common.minutes', { count: minutes })} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)}>
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)}>
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
      </Animated.View>
    </Screen>
  );
}
