import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatInZone, hoursUntil, type Recommendation } from '@lingonest/core';
import { Badge, Button, Card, LevelPill, ProgressBar, Screen, Text } from '@/components';
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
      error={result && !result.ok ? result.error : null}
      onRetry={() => void snapshotQuery.refetch()}
      onRefresh={() => void snapshotQuery.refetch()}
      refreshing={snapshotQuery.isRefetching}
    >
      {snapshot ? (
        <>
          <Text variant="small" color="muted">
            {greeting}
          </Text>
          <Text variant="title">{profile?.displayName ?? ''}</Text>

          {/* Where am I */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  glyph="▲"
                />
              ) : null}
            </View>

            <ProgressBar
              value={goalProgress}
              label={t('home.todaysGoal')}
              style={{ marginTop: spacing.lg }}
            />
            <Text variant="caption" color={snapshot.goal.met ? 'success' : 'muted'} style={{ marginTop: spacing.xs }}>
              {snapshot.goal.met
                ? t('home.goalMet')
                : t('home.goalProgress', {
                    done: snapshot.goal.minutesDone,
                    target: snapshot.goal.targetMinutes,
                  })}
            </Text>
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
          <Text variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            {t('lesson.nextStep')}
          </Text>

          {snapshot.recommendations.slice(0, 5).map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
          ))}

          {snapshot.recommendations.length === 0 ? (
            <Card>
              <Text variant="body">{t('practice.noneDue')}</Text>
              <Button
                label={t('learn.title')}
                onPress={() => router.push('/(tabs)/learn')}
                variant="secondary"
                style={{ marginTop: spacing.md }}
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const { spacing } = useTheme();
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
    <Card onPress={go} style={{ marginBottom: spacing.md }} accessibilityLabel={t(recommendation.titleKey, recommendation.titleParams)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text variant="subheading">{t(recommendation.titleKey, recommendation.titleParams)}</Text>
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
