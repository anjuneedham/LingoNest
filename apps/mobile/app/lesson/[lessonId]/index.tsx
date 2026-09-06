import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, LevelPill, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchLesson } from '@/services/content';
import { track } from '@/services/analytics';

/**
 * The lesson intro.
 *
 * Answers the two questions the brief insists a learner can always answer:
 * what am I learning, and why (§96). The can-do statement is the promise; the
 * vocabulary preview is what it will cost.
 */
export default function LessonIntro() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchLesson(lessonId),
    enabled: Boolean(lessonId),
  });

  const result = lessonQuery.data;
  const lesson = result?.ok ? result.value : null;

  return (
    <Screen
      loading={lessonQuery.isLoading}
      error={result && !result.ok ? result.error : null}
      onRetry={() => void lessonQuery.refetch()}
    >
      {lesson ? (
        <>
          <Text variant="caption" color="muted">
            {lesson.unitTitle}
          </Text>
          <Text variant="title" style={{ marginTop: spacing.xs }}>
            {lesson.title}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm }}>
            <LevelPill level={lesson.cefr} size="small" />
            <Badge label={t('learn.lessonMinutes', { count: lesson.estimatedMinutes })} glyph="◷" />
          </View>

          <Card style={{ marginTop: spacing.xl }}>
            <Text variant="caption" color="muted">
              {t('lesson.canDo')}
            </Text>
            <Text variant="subheading" style={{ marginTop: spacing.xs }}>
              {lesson.canDo}
            </Text>
            <Text variant="body" color="muted" style={{ marginTop: spacing.md }}>
              {lesson.objective}
            </Text>
          </Card>

          {lesson.vocabulary.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <Text variant="caption" color="muted">
                {t('lesson.newWords', { count: lesson.vocabulary.length })}
              </Text>
              <View style={{ marginTop: spacing.md }}>
                {lesson.vocabulary.slice(0, 8).map((word) => (
                  <View
                    key={word.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Text variant="body">{word.term}</Text>
                    <Text variant="body" color="muted">
                      {word.translation}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Button
            label={t('lesson.start')}
            onPress={() => {
              track('lesson_started', { lessonId: lesson.id, unitId: '', cefr: lesson.cefr });
              router.push(`/lesson/${lesson.id}/play`);
            }}
            fullWidth
            size="large"
            style={{ marginTop: spacing.xxl }}
          />
        </>
      ) : null}
    </Screen>
  );
}
