import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LAUNCH_LANGUAGES } from '@lingonest/content';
import type { ContentStatus } from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchContentTree } from '@/services/admin';

const STATUS_TONE: Record<ContentStatus, 'neutral' | 'success' | 'warning'> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'warning',
  published: 'success',
  archived: 'neutral',
};

/**
 * The content tree.
 *
 * Curriculum is data (brief §46), so this screen is a real editor over the
 * same `courses` → `units` → `lessons` tables the seed pipeline writes to —
 * there is no separate "CMS content" shadowing what learners actually see.
 */
export default function ContentTree() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const [languageCode, setLanguageCode] = useState(LAUNCH_LANGUAGES[0]?.code ?? 'es');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const treeQuery = useQuery({
    queryKey: ['admin-content-tree', languageCode],
    queryFn: () => fetchContentTree(languageCode),
  });

  const courses = treeQuery.data?.ok ? treeQuery.data.value : [];

  return (
    <Screen
      loading={treeQuery.isLoading}
      error={treeQuery.data && !treeQuery.data.ok ? treeQuery.data.error : null}
      onRetry={() => void treeQuery.refetch()}
      empty={
        treeQuery.data?.ok && courses.length === 0
          ? { title: t('admin.noCourses') }
          : null
      }
    >
      <Text variant="title">{t('admin.content')}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }}>
        {LAUNCH_LANGUAGES.map((language) => (
          <Button
            key={language.code}
            label={language.name}
            size="small"
            variant={language.code === languageCode ? 'primary' : 'ghost'}
            onPress={() => setLanguageCode(language.code)}
          />
        ))}
      </View>

      {courses.map((course) => (
        <Card key={course.id} style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="subheading">{course.title}</Text>
            <Badge label={t(`admin.status.${course.status}`)} tone={STATUS_TONE[course.status]} />
          </View>

          {course.units.length === 0 ? (
            <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
              {t('admin.noLessons')}
            </Text>
          ) : null}

          {course.units.map((unit) => {
            const expanded = expandedUnit === unit.id;
            return (
              <View key={unit.id} style={{ marginTop: spacing.md }}>
                <Card
                  padded={false}
                  onPress={() => setExpandedUnit(expanded ? null : unit.id)}
                  style={{ padding: spacing.md, backgroundColor: theme.surfaceMuted }}
                  accessibilityLabel={unit.title}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text variant="body">{unit.title}</Text>
                    <Badge label={t(`admin.status.${unit.status}`)} tone={STATUS_TONE[unit.status]} />
                  </View>
                </Card>

                {expanded ? (
                  <View style={{ marginTop: spacing.sm }}>
                    {unit.lessons.length === 0 ? (
                      <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
                        {t('admin.noLessons')}
                      </Text>
                    ) : null}
                    {unit.lessons.map((lesson) => (
                      <Card
                        key={lesson.id}
                        onPress={() => router.push(`/(admin)/content/${lesson.id}`)}
                        style={{ marginTop: spacing.sm }}
                        accessibilityLabel={lesson.title}
                      >
                        <View
                          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
                        >
                          <View style={{ flex: 1, marginRight: spacing.sm }}>
                            <Text variant="body">{lesson.title}</Text>
                            <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                              {t('admin.activityCount', { count: lesson.activityCount })}
                              {lesson.generatedBy === 'ai' ? `  ·  ${t('admin.aiDraft')}` : ''}
                            </Text>
                          </View>
                          <Badge label={t(`admin.status.${lesson.status}`)} tone={STATUS_TONE[lesson.status]} />
                        </View>
                      </Card>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}
