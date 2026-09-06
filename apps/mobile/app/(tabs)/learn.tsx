import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import {
  cefrDisplay,
  compareCefr,
  evaluateLevelReadiness,
  type Cefr,
  type LevelStats,
} from '@lingonest/core';
import { Badge, Card, LevelPill, ProgressBar, Screen, Skeleton, SkeletonCard, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation } from '@/theme/tokens';
import { fetchCurriculum, type CourseSummary, type LessonSummary, type UnitSummary } from '@/services/content';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { feedbackTap } from '@/services/feedback';

/**
 * The learning path.
 *
 * A locked level lists exactly what is still missing rather than showing a bare
 * padlock (brief §57): the criteria come from `evaluateLevelReadiness`, so what
 * the learner is told matches what actually gates progression.
 */
export default function Learn() {
  const { spacing } = useTheme();
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
      skeleton={
        <>
          <Skeleton width="45%" height={22} />
          <SkeletonCard lines={2} style={{ marginTop: spacing.lg }} />
          <SkeletonCard lines={2} style={{ marginTop: spacing.lg }} />
          <SkeletonCard lines={2} style={{ marginTop: spacing.lg }} />
        </>
      }
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

  const isCompleted = progress === 1;
  const isCurrent = course.cefr === currentLevel;

  return (
    <Card
      onPress={onToggle}
      raised={isCurrent}
      style={{
        marginTop: spacing.lg,
        borderColor: isCurrent ? theme.primary : isCompleted ? theme.success : undefined,
        borderWidth: isCurrent || isCompleted ? 2 : 1,
      }}
      accessibilityLabel={`${cefrDisplay(course.cefr)} ${course.title}`}
      accessibilityHint={expanded ? undefined : t('common.seeAll')}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <LevelPill level={course.cefr} size="small" />
            {isCurrent ? (
              <Badge label={t('learn.currentLevel')} tone="primary" glyph="✨" />
            ) : null}
            {isCompleted ? (
              <Badge label={t('learn.completed') || 'Completed'} tone="success" glyph="✓" />
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
        color={isCompleted ? theme.success : isCurrent ? theme.primary : undefined}
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

      <LessonPath lessons={unit.lessons} />
    </View>
  );
}

/**
 * The lesson path.
 *
 * A winding node trail rather than a settings-style list: the curve traces
 * how far a learner has come (the green stretch of `donePath`) and where
 * they're headed next (the pulsing node), so a unit reads as a place to
 * travel through rather than a menu to pick from.
 */
const NODE_SIZE = 60;
const V_GAP = 112;
const TOP_PAD = 46;
const BOTTOM_PAD = 56;
const AMPLITUDE_PCT = 24;

function pathXPercent(index: number): number {
  return 50 + AMPLITUDE_PCT * Math.sin((index * Math.PI) / 2);
}

function pathY(index: number): number {
  return TOP_PAD + NODE_SIZE / 2 + index * V_GAP;
}

function buildCurve(points: ReadonlyArray<{ x: number; y: number }>): string {
  const [first, ...rest] = points;
  if (!first) return '';
  let prev = first;
  let d = `M ${prev.x} ${prev.y}`;
  for (const point of rest) {
    const midY = (prev.y + point.y) / 2;
    d += ` C ${prev.x} ${midY}, ${point.x} ${midY}, ${point.x} ${point.y}`;
    prev = point;
  }
  return d;
}

function LessonPath({ lessons }: { lessons: readonly LessonSummary[] }) {
  const { theme } = useTheme();

  const points = lessons.map((_, i) => ({ x: pathXPercent(i), y: pathY(i) }));
  const totalHeight = lessons.length === 0 ? 0 : pathY(lessons.length - 1) + NODE_SIZE / 2 + BOTTOM_PAD;

  // Lessons complete in order, so the first non-completed one is both where
  // the coloured stretch of the path ends and which node gets the pulse.
  const firstIncompleteIndex = lessons.findIndex((l) => l.status !== 'completed');
  const progressEndIndex = firstIncompleteIndex === -1 ? lessons.length - 1 : firstIncompleteIndex;

  const fullPath = buildCurve(points);
  const donePath = progressEndIndex > 0 ? buildCurve(points.slice(0, progressEndIndex + 1)) : '';

  if (lessons.length === 0) return null;

  return (
    <View style={{ marginTop: 12, position: 'relative', width: '100%', height: totalHeight }}>
      <Svg
        width="100%"
        height={totalHeight}
        viewBox={`0 0 100 ${totalHeight}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <SvgPath d={fullPath} stroke={theme.border} strokeWidth={5} fill="none" strokeLinecap="round" />
        {donePath ? (
          <SvgPath d={donePath} stroke={theme.success} strokeWidth={5} fill="none" strokeLinecap="round" />
        ) : null}
      </Svg>

      {lessons.map((lesson, i) => {
        const point = points[i] ?? { x: 50, y: pathY(i) };
        return (
          <LessonNode
            key={lesson.id}
            lesson={lesson}
            index={i}
            xPercent={point.x}
            y={point.y}
            isNext={i === firstIncompleteIndex}
          />
        );
      })}
    </View>
  );
}

function LessonNode({
  lesson,
  index,
  xPercent,
  y,
  isNext,
}: {
  lesson: LessonSummary;
  index: number;
  xPercent: number;
  y: number;
  isNext: boolean;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isNext) {
      pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
    }
  }, [isNext, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const isDone = lesson.status === 'completed';
  const isActive = isNext || lesson.status === 'in_progress';
  const circleColor = isDone ? theme.success : isActive ? theme.primary : theme.surfaceMuted;
  const glyph = isDone ? '✓' : lesson.isCheckpoint ? '⭐' : lesson.isReview ? '↻' : String(lesson.ordinal);

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50)}
      style={{
        position: 'absolute',
        top: y - NODE_SIZE / 2,
        left: `${xPercent}%`,
        width: NODE_SIZE,
        marginLeft: -NODE_SIZE / 2,
        alignItems: 'center',
      }}
    >
      {isNext ? (
        <View
          style={{
            position: 'absolute',
            top: -30,
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: theme.primary,
          }}
        >
          <Text variant="caption" color="inverse" style={{ fontWeight: '700' }}>
            {t('lesson.start')}
          </Text>
        </View>
      ) : null}

      <Animated.View style={isNext ? pulseStyle : undefined}>
        <Pressable
          onPress={() => {
            feedbackTap();
            router.push(`/lesson/${lesson.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={lesson.title}
          accessibilityHint={lesson.canDo}
          style={{
            width: NODE_SIZE,
            height: NODE_SIZE,
            borderRadius: NODE_SIZE / 2,
            borderWidth: 3,
            borderColor: circleColor,
            backgroundColor: circleColor,
            alignItems: 'center',
            justifyContent: 'center',
            ...elevation.card,
          }}
        >
          <Text variant="subheading" color={isDone || isActive ? 'inverse' : 'muted'} style={{ fontWeight: '700' }}>
            {glyph}
          </Text>
        </Pressable>
      </Animated.View>

      <Text variant="caption" color="muted" numberOfLines={2} style={{ marginTop: 6, width: 96, textAlign: 'center' }}>
        {lesson.title}
      </Text>
    </Animated.View>
  );
}
