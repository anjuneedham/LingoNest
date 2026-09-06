import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatInZone, hoursUntil, type Recommendation } from '@lingonest/core';
import { Badge, Button, Card, LevelPill, ProgressBar, Screen, Skeleton, SkeletonCard, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchHomeSnapshot } from '@/services/learner';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

/**
 * Home.
 *
 * Everything here is the adaptive engine's output rather than a fixed layout:
 * each card says what to do and why, in that order. The learner should be able
 * to answer "where am I, what next, how am I doing" without scrolling (§96).
 */
export default function Home() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);

  const snapshotQuery = useQuery({
    queryKey: ['home', profile?.id, languageCode],
    queryFn: () => fetchHomeSnapshot(profile!.id, languageCode!),
    enabled: Boolean(profile?.id && languageCode),
    staleTime: 30_000,
  });

  const result = snapshotQuery.data;
  const snapshot = result?.ok ? result.value : null;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);

  if (!languageCode) {
    return (
      <Screen
        empty={{
          title: t('home.noLanguageYet'),
          actionLabel: t('onboarding.chooseLanguage'),
          onAction: () => router.push('/(onboarding)/language'),
        }}
      />
    );
  }

  const goalProgress =
    snapshot && snapshot.goal.targetMinutes > 0
      ? Math.min(1, snapshot.goal.minutesDone / snapshot.goal.targetMinutes)
      : 0;

  return (
    <Screen
      loading={snapshotQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="40%" height={13} />
          <Skeleton width="55%" height={28} style={{ marginTop: spacing.sm }} />
          <SkeletonCard lines={2} style={{ marginTop: spacing.lg }} />
          <Skeleton width="35%" height={20} style={{ marginTop: spacing.xl, marginBottom: spacing.lg }} />
          <SkeletonCard lines={2} style={{ marginBottom: spacing.md }} />
          <SkeletonCard lines={2} style={{ marginBottom: spacing.md }} />
        </>
      }
      error={result && !result.ok ? result.error : null}
      onRetry={() => void snapshotQuery.refetch()}
      onRefresh={() => void snapshotQuery.refetch()}
      refreshing={snapshotQuery.isRefetching}
    >
      {snapshot ? (
        <>
          <View style={{ marginBottom: spacing.sm }}>
            <Text variant="small" color="muted">
              {greeting}
            </Text>
            <Text variant="title" style={{ marginTop: spacing.xs }}>
              {profile?.displayName ?? ''}
            </Text>
          </View>

          {/* Where am I */}
          <Card style={{ marginTop: spacing.lg, borderColor: snapshot.goal.met ? '#16A34A' : undefined }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <View>
                <Text variant="caption" color="muted">
                  {snapshot.languageName}
                </Text>
                <View style={{ marginTop: spacing.xs }}>
                  <LevelPill level={snapshot.levels.overall ?? null} showEstimatedLabel />
                </View>
              </View>
              {snapshot.streak.current > 0 ? (
                <Badge
                  label={t('home.streakDays', { count: snapshot.streak.current })}
                  tone="streak"
                  glyph="🔥"
                />
              ) : null}
            </View>

            <ProgressBar
              value={goalProgress}
              label={t('home.todaysGoal')}
            />
            <View style={{ marginTop: spacing.md }}>
              <Text variant="caption" color={snapshot.goal.met ? 'success' : 'muted'} style={{ fontWeight: '600' }}>
                {snapshot.goal.met
                  ? '✅ ' + t('home.goalMet')
                  : t('home.goalProgress', {
                      done: snapshot.goal.minutesDone,
                      target: snapshot.goal.targetMinutes,
                    })}
              </Text>
            </View>
          </Card>

          {/* Next tutor lesson, if one is coming */}
          {snapshot.nextBooking ? (
            <Card style={{ marginTop: spacing.lg }} raised>
              <Text variant="caption" color="muted">
                {t('home.nextTutorLesson')}
              </Text>
              <Text variant="subheading" style={{ marginTop: spacing.xs }}>
                {snapshot.nextBooking.teacherName}
              </Text>
              <Text variant="body" color="muted" style={{ marginTop: 2 }}>
                {formatInZone(
                  new Date(snapshot.nextBooking.startsAt).getTime(),
                  profile?.timezone ?? 'UTC',
                )}
              </Text>
              {hoursUntil(new Date(snapshot.nextBooking.startsAt).getTime()) <= 0.25 ? (
                <Button
                  label={t('home.joinLesson')}
                  onPress={() => router.push(`/room/${snapshot.nextBooking!.id}`)}
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </Card>
          ) : null}

          {/* What next, and why */}
          <Text variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
            {t('lesson.nextStep')}
          </Text>

          {snapshot.recommendations.length > 0 ? (
            snapshot.recommendations.slice(0, 5).map((recommendation, idx) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                isFirst={idx === 0}
              />
            ))
          ) : (
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text variant="heading" color="muted">
                  ✨
                </Text>
                <Text variant="body" style={{ marginTop: spacing.md }}>
                  {t('practice.noneDue')}
                </Text>
                <Text variant="small" color="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                  {t('common.exploreLearning') || 'Explore more content to continue learning'}
                </Text>
              </View>
              <Button
                label={t('learn.title')}
                onPress={() => router.push('/(tabs)/learn')}
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function RecommendationCard({
  recommendation,
  isFirst = false,
}: {
  recommendation: Recommendation;
  isFirst?: boolean;
}) {
  const { spacing, theme } = useTheme();
  const { t } = useTranslation();

  const go = () => {
    switch (recommendation.kind) {
      case 'lesson':
        if (recommendation.targetId) router.push(`/lesson/${recommendation.targetId}`);
        break;
      case 'review':
        router.push('/practice/review');
        break;
      case 'speaking':
        router.push('/practice/speaking');
        break;
      case 'listening':
        router.push('/practice/listening');
        break;
      case 'writing':
        router.push('/practice/writing');
        break;
      case 'conversation':
        router.push('/(tabs)/practice');
        break;
      case 'grammar':
        router.push('/practice/mistakes');
        break;
      default:
        router.push('/practice/quick');
    }
  };

  return (
    <Card
      onPress={go}
      raised={isFirst}
      style={{
        marginBottom: spacing.md,
        borderColor: isFirst ? theme.primary : undefined,
        borderWidth: isFirst ? 2 : 1,
      }}
      accessibilityLabel={t(recommendation.titleKey, recommendation.titleParams)}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          {isFirst ? (
            <Text variant="caption" color="primary" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              ★ {t('lesson.nextStep')}
            </Text>
          ) : null}
          <Text variant={isFirst ? 'title' : 'subheading'}>
            {t(recommendation.titleKey, recommendation.titleParams)}
          </Text>
          {/* The reason is the point: never a card that just says "practise". */}
          <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
            {t(recommendation.reasonKey, recommendation.reasonParams)}
          </Text>
        </View>
        <Badge label={t('common.minutes', { count: recommendation.estimatedMinutes })} />
      </View>
    </Card>
  );
}
