import React from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { parseCefr } from '@lingonest/core';
import { Card, LevelPill, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useLearningStore } from '@/store/learning';

/**
 * Writing practice.
 *
 * Draws lessons from the published curriculum that train this skill, so the
 * practice tab reuses real content rather than a parallel set of exercises.
 */
export default function WritingPractice() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);

  const lessonsQuery = useQuery({
    queryKey: ['skill-lessons', 'writing', languageCode],
    queryFn: async () => {
      const { data } = await supabase
        .from('lessons')
        .select(
          'id, title, objective, cefr, estimated_minutes, skills, units!inner(courses!inner(languages!inner(code)))',
        )
        .contains('skills', ['writing'])
        .eq('units.courses.languages.code', languageCode!)
        .limit(20);
      return data ?? [];
    },
    enabled: Boolean(languageCode),
  });

  const lessons = lessonsQuery.data ?? [];

  return (
    <Screen
      loading={lessonsQuery.isLoading}
      empty={
        !lessonsQuery.isLoading && lessons.length === 0
          ? { title: t('error.content_unavailable') }
          : null
      }
    >
      <Text variant="title">{t('practice.writing')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('practice.writingBody')}
      </Text>

      {lessons.map((lesson) => (
        <Card
          key={lesson.id}
          onPress={() => router.push(`/lesson/${lesson.id}`)}
          style={{ marginTop: spacing.md }}
          accessibilityLabel={lesson.title}
        >
          <LevelPill level={parseCefr(lesson.cefr)} size="small" />
          <Text variant="subheading" style={{ marginTop: spacing.sm }}>
            {lesson.title}
          </Text>
          <Text variant="small" color="muted" style={{ marginTop: 2 }}>
            {lesson.objective}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
