import React from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { callFunction } from '@/services/api';
import { useLearningStore } from '@/store/learning';

/**
 * Quick practice, planned by the AI coach.
 *
 * The coach reads the learner's real weaknesses and proposes a session that
 * fits the time available. Without a coach entitlement the screen falls back to
 * review and mistake practice rather than showing an upsell wall.
 */
export default function QuickPractice() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);

  const coachQuery = useQuery({
    queryKey: ['coach', languageCode],
    queryFn: () =>
      callFunction<{
        message: string;
        plan: { kind: string; focus: string; minutes: number; reason: string }[];
      }>('ai-coach', { languageCode, minutesAvailable: 5 }),
    enabled: Boolean(languageCode),
    retry: false,
  });

  const result = coachQuery.data;
  const plan = result?.ok ? result.value : null;
  const unavailable = result && !result.ok;

  return (
    <Screen loading={coachQuery.isLoading}>
      <Text variant="title">{t('practice.quick')}</Text>

      {plan ? (
        <>
          <Card style={{ marginTop: spacing.lg }}>
            <Text variant="caption" color="muted">
              {t('ai.coachIntro')}
            </Text>
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              {plan.message}
            </Text>
          </Card>

          {plan.plan.map((step, index) => (
            <Card key={`${step.kind}-${index}`} style={{ marginTop: spacing.md }}>
              <Text variant="subheading">{step.focus}</Text>
              <Text variant="small" color="muted" style={{ marginTop: 2 }}>
                {step.reason}
              </Text>
              <Button
                label={t('common.minutes', { count: step.minutes })}
                onPress={() =>
                  router.push(step.kind === 'review' ? '/practice/review' : '/practice/mistakes')
                }
                variant="secondary"
                size="small"
                style={{ marginTop: spacing.md }}
              />
            </Card>
          ))}
        </>
      ) : null}

      {unavailable ? (
        <>
          <Card style={{ marginTop: spacing.lg }}>
            <Text variant="body" color="muted">
              {t(result.error.messageKey, { defaultValue: t('error.unknown') })}
            </Text>
          </Card>

          {/* The product still works without the coach. */}
          <Button
            label={t('practice.review')}
            onPress={() => router.replace('/practice/review')}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
          <Button
            label={t('practice.mistakes')}
            onPress={() => router.replace('/practice/mistakes')}
            variant="secondary"
            fullWidth
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : null}
    </Screen>
  );
}
