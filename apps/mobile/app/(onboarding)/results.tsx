import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { cefrDisplay, parseCefr } from '@lingonest/core';
import { Button, Card, LevelPill, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The placement result.
 *
 * Reports an estimate with a confidence, says where the learner will start and
 * why, and is explicit that this is not a certificate (brief §30, §77).
 */
export default function PlacementResults() {
  const { estimated, start, confidence, answered } = useLocalSearchParams<{
    estimated?: string;
    start?: string;
    confidence?: string;
    answered?: string;
  }>();
  const { spacing } = useTheme();
  const { t } = useTranslation();

  const estimatedLevel = parseCefr(estimated ?? 'A1');
  const startLevel = parseCefr(start ?? estimated ?? 'A1');
  const confidenceValue = Number(confidence ?? 0);
  const startsLower = startLevel !== estimatedLevel;

  return (
    <Screen>
      <Text variant="title" style={{ marginTop: spacing.xl }}>
        {t('placement.resultTitle')}
      </Text>

      <Card style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <LevelPill level={estimatedLevel} showEstimatedLabel />
        <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.md }}>
          {confidenceValue >= 0.7
            ? t('placement.result.confident', {
                count: Number(answered ?? 0),
                level: cefrDisplay(estimatedLevel ?? 'A1'),
              })
            : t('placement.result.provisional', { level: cefrDisplay(estimatedLevel ?? 'A1') })}
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="body">
          {startsLower
            ? t('placement.startingLower', { level: cefrDisplay(startLevel ?? 'A1') })
            : t('placement.startingAt', { level: cefrDisplay(startLevel ?? 'A1') })}
        </Text>
        <Text variant="small" color="muted" style={{ marginTop: spacing.md }}>
          {t('placement.skillsNote')}
        </Text>
        <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
          {t('placement.notCertification')}
        </Text>
      </Card>

      <Button
        label={t('placement.begin')}
        onPress={() => router.push('/(onboarding)/goal')}
        fullWidth
        size="large"
        style={{ marginTop: spacing.xxl }}
      />
    </Screen>
  );
}
