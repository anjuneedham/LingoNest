import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { promptSchemas } from '@lingonest/core';
import { Button, Card, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import type { ActivityRendererProps } from '../types';

/**
 * A review block inside a lesson.
 *
 * Its items are not authored: they are drawn at run time from the learner's own
 * SRS queue or recent mistakes, so the same lesson reviews different words for
 * different people. It hands off to the review session, which reports back.
 */
export function ReviewChallengeActivity({ activity, onSubmit, disabled }: ActivityRendererProps) {
  const { spacing } = useTheme();
  const { t } = useTranslation();

  const prompt = React.useMemo(() => {
    const parsed = promptSchemas.review_challenge.safeParse(activity.prompt);
    return parsed.success ? parsed.data : null;
  }, [activity]);

  if (!prompt) return <Text color="danger">Unable to display this activity</Text>;

  const sourceLabel =
    prompt.source === 'recent_mistakes'
      ? t('practice.mistakes')
      : prompt.source === 'srs_due'
        ? t('practice.review')
        : t('lesson.stage.review');

  return (
    <View>
      <Card>
        <Text variant="caption" color="muted">
          {sourceLabel}
        </Text>
        <Text variant="heading" style={{ marginTop: spacing.sm }}>
          {prompt.instruction}
        </Text>
        <Text variant="small" color="muted" style={{ marginTop: spacing.sm }}>
          {t('common.words', { count: prompt.itemCount })}
        </Text>
      </Card>

      <Button
        label={t('practice.review')}
        onPress={() => {
          router.push({
            pathname: '/practice/review',
            params: { source: prompt.source, count: String(prompt.itemCount) },
          });
          onSubmit?.({ items: [] });
        }}
        disabled={disabled}
        fullWidth
        style={{ marginTop: spacing.xl }}
      />
    </View>
  );
}
