import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { parseCefr } from '@lingonest/core';
import { Card, LevelPill, Screen, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { PRACTICE_MODE_COLORS } from '@/theme/practiceModes';
import { supabase } from '@/services/supabase';
import { useLearningStore } from '@/store/learning';

/**
 * Speaking practice.
 *
 * Draws lessons from the published curriculum that train this skill, so the
 * practice tab reuses real content rather than a parallel set of exercises.
 */
export default function SpeakingPractice() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);

  const lessonsQuery = useQuery({
    queryKey: ['skill-lessons', 'speaking', languageCode],
    queryFn: async () => {
      const { data } = await supabase
        .from('lessons')
        .select(
          'id, title, objective, cefr, estimated_minutes, skills, units!inner(courses!inner(languages!inner(code)))',
        )
        .contains('skills', ['speaking'])
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
      skeleton={
        <>
          <Skeleton width="40%" height={22} />
          <Skeleton width="70%" height={13} style={{ marginTop: spacing.xs }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginTop: spacing.md, padding: spacing.lg }}>
              <Skeleton width={48} height={20} radius={999} />
              <Skeleton width="60%" height={16} style={{ marginTop: spacing.sm }} />
              <Skeleton width="80%" height={12} style={{ marginTop: spacing.xs }} />
            </View>
          ))}
        </>
      }
      empty={
        !lessonsQuery.isLoading && lessons.length === 0
          ? { title: t('error.content_unavailable') }
          : null
      }
    >
      <Text variant="title">{t('practice.speaking')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('practice.speakingBody')}
      </Text>

      {lessons.map((lesson, i) => (
        <Animated.View key={lesson.id} entering={FadeInDown.delay(i * 60)}>
          <Card
            onPress={() => router.push(`/lesson/${lesson.id}`)}
            style={{
              marginTop: spacing.md,
              borderLeftWidth: 4,
              borderLeftColor: PRACTICE_MODE_COLORS.speaking,
            }}
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
        </Animated.View>
      ))}
    </Screen>
  );
}
