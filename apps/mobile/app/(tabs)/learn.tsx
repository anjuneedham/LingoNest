import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  cefrDisplay,
  compareCefr,
  evaluateLevelReadiness,
  type Cefr,
  type LevelStats,
} from '@lingonest/core';
import { Badge, Card, LevelPill, ProgressBar, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchCurriculum, type CourseSummary, type UnitSummary } from '@/services/content';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

/**
 * The learning path.
 *
 * A locked level lists exactly what is still missing rather than showing a bare
 * padlock (brief §57): the criteria come from `evaluateLevelReadiness`, so what
 * the learner is told matches what actually gates progression.
 */
export default function Learn() {
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);
  const cachedLevels = useLearningStore((s) => s.cachedLevels);
  const [expanded, setExpanded] = useState<string | null>(null);

  const curriculumQuery = useQuery({
    queryKey: ['curriculum', languageCode, profile?.id],
    queryFn: () => fetchCurriculum(languageCode!, profile!.id),
    enabled: Boolean(languageCode && profile?.id),
    staleTime: 5 * 60_000,
  });

  const result = curriculumQuery.data;
  const courses = result?.ok ? result.value : [];
  const currentLevel = (cachedLevels.overall ?? 'PRE_A1') as Cefr;

  return (
    <Screen
      loading={curriculumQuery.isLoading}
      error={result && !result.ok ? result.error : null}
      onRetry={() => void curriculumQuery.refetch()}
      empty={
        !curriculumQuery.isLoading && courses.length === 0
          ? { title: t('error.content_unavailable') }
          : null
      }
    >
      <Text variant="title">{t('learn.yourPath')}</Text>

      {courses.map((course) => (
        <CourseRow
          key={course.id}
          course={course}
          currentLevel={currentLevel}
          expanded={expanded === course.id}
          onToggle={() => setExpanded(expanded === course.id ? null : course.id)}
        />
      ))}
    </Screen>
  );
}

function CourseRow({
  course,
  currentLevel,
  expanded,
  onToggle,
}: {
  course: CourseSummary;
  currentLevel: Cefr;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();

  const lessons = course.units.flatMap((u) => u.lessons);
  const completed = lessons.filter((l) => l.status === 'completed');
  const progress = lessons.length === 0 ? 0 : completed.length / lessons.length;

  // A level above the learner's current estimate is gated. The criteria are
  // computed from what we actually know, so the list is specific.
  const isAhead = compareCefr(course.cefr, currentLevel) > 0;

  const readiness = useMemo(() => {
    if (!isAhead) return null;
    const stats: LevelStats = {
      lessonsTotal: lessons.length,
      lessonsCompleted: completed.length,
      vocabularyTotal: 0,
      vocabularyMastered: 0,
      accuracy:
        completed.length === 0
          ? 0
          : completed.reduce((sum, l) => sum + l.bestScore, 0) / completed.length,
      accuracyBySkill: {},
      checkpointScore:
        lessons.find((l) => l.isCheckpoint && l.status === 'completed')?.bestScore ?? null,
      speakingTasksCompleted: 0,
      activeDays: 0,
    };
    return evaluateLevelReadiness(course.cefr, stats);
  }, [isAhead, course.cefr, lessons, completed]);

  return (
    <Card
      onPress={onToggle}
      style={{ marginTop: spacing.lg }}
      accessibilityLabel={`${cefrDisplay(course.cefr)} ${course.title}`}
      accessibilityHint={expanded ? undefined : t('common.seeAll')}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <LevelPill level={course.cefr} size="small" />
            {course.cefr === currentLevel ? (
              <Badge label={t('learn.currentLevel')} tone="primary" glyph="◆" />
            ) : null}
            {isAhead && readiness && !readiness.ready ? (
              <Badge label={t('learn.locked')} glyph="🔒" />
            ) : null}
          </View>
          <Text variant="subheading" style={{ marginTop: spacing.sm }}>
            {course.title}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {expanded ? '▾' : '▸'}
        </Text>
      </View>

      <ProgressBar
        value={progress}
        showPercentage
        label={t('learn.levelProgress', {
          percent: Math.round(progress * 100),
          level: cefrDisplay(course.cefr),
        })}
        style={{ marginTop: spacing.md }}
      />

      {/* Locked levels explain themselves rather than showing a padlock. */}
      {isAhead && readiness && !readiness.ready ? (
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: theme.surfaceMuted,
          }}
        >
          <Text variant="caption" color="muted">
            {t('learn.lockedWhy', { level: cefrDisplay(course.cefr) })}
          </Text>
          {readiness.unmet.slice(0, 4).map((criterion) => (
            <Text key={criterion.criterion} variant="small" style={{ marginTop: spacing.xs }}>
              {`· ${t(criterion.messageKey)}`}
            </Text>
          ))}
        </View>
      ) : null}

      {expanded ? (
        <View style={{ marginTop: spacing.lg }}>
          {course.units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function UnitRow({ unit }: { unit: UnitSummary }) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="bodyStrong">{`${unit.ordinal}. ${unit.title}`}</Text>
      <Text variant="small" color="muted" style={{ marginTop: 2 }}>
        {unit.objective}
      </Text>

      {unit.realWorldTask ? (
        <View
          style={{
            marginTop: spacing.sm,
            padding: spacing.sm,
            borderRadius: radius.sm,
            backgroundColor: theme.primaryMuted,
          }}
        >
          <Text variant="caption" color="primary">
            {`${t('learn.realWorldTask')}: ${unit.realWorldTask}`}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.sm }}>
        {unit.lessons.map((lesson) => (
          <Pressable
            key={lesson.id}
            onPress={() => router.push(`/lesson/${lesson.id}`)}
            accessibilityRole="button"
            accessibilityLabel={lesson.title}
            accessibilityHint={lesson.canDo}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: lesson.status === 'completed' ? theme.success : theme.border,
                backgroundColor: lesson.status === 'completed' ? theme.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}
            >
              <Text variant="caption" color={lesson.status === 'completed' ? 'inverse' : 'muted'}>
                {lesson.status === 'completed' ? '✓' : String(lesson.ordinal)}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text variant="body">{lesson.title}</Text>
              <Text variant="caption" color="muted">
                {t('learn.lessonMinutes', { count: lesson.estimatedMinutes })}
              </Text>
            </View>

            {lesson.isCheckpoint ? <Badge label={t('learn.checkpoint')} tone="primary" glyph="◈" /> : null}
            {lesson.isReview && !lesson.isCheckpoint ? <Badge label={t('learn.review')} glyph="↻" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
