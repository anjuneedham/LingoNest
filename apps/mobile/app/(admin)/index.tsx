import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Screen, Skeleton, SkeletonCard, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchAdminOverview } from '@/services/admin';
import { useSessionStore } from '@/store/session';

/**
 * The admin dashboard.
 *
 * Every number here is a real query (`fetchAdminOverview`) rather than a
 * placeholder metric — there is no fake analytics widget standing in for one
 * that isn't wired up yet (brief §94).
 */
export default function AdminDashboard() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const roles = useSessionStore((s) => s.roles);
  const isAdmin = roles.includes('admin');
  const isContentEditor = isAdmin || roles.includes('content_editor');

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchAdminOverview,
    staleTime: 30_000,
  });

  const overview = overviewQuery.data?.ok ? overviewQuery.data.value : null;

  return (
    <Screen
      loading={overviewQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="45%" height={22} />
          <SkeletonCard lines={2} style={{ marginTop: spacing.lg }} />
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ marginTop: spacing.md, padding: spacing.lg }}>
              <Skeleton width="60%" height={16} />
            </View>
          ))}
        </>
      }
      error={overviewQuery.data && !overviewQuery.data.ok ? overviewQuery.data.error : null}
      onRetry={() => void overviewQuery.refetch()}
    >
      <Text variant="title">{t('admin.dashboard')}</Text>

      {overview ? (
        <>
          <Card style={{ marginTop: spacing.lg }}>
            <Text variant="subheading">{t('admin.content')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {Object.entries(overview.lessonsByStatus).map(([status, count]) => (
                <Badge
                  key={status}
                  label={`${t(`admin.status.${status}`)}: ${count}`}
                  tone={status === 'published' ? 'success' : status === 'archived' ? 'neutral' : 'warning'}
                />
              ))}
            </View>
            {overview.aiDraftsAwaitingReview > 0 ? (
              <Text variant="caption" color="muted" style={{ marginTop: spacing.md }}>
                {t('admin.validationIssues', { count: overview.aiDraftsAwaitingReview })}
              </Text>
            ) : null}
          </Card>

          {isContentEditor ? (
            <Card
              onPress={() => router.push('/(admin)/content')}
              style={{ marginTop: spacing.lg }}
              accessibilityLabel={t('admin.content')}
            >
              <Text variant="body">{t('admin.content')}</Text>
              <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
                {t('admin.validationPassed')}
              </Text>
            </Card>
          ) : null}

          {isContentEditor ? (
            <Card
              onPress={() => router.push('/(admin)/review-queue')}
              style={{ marginTop: spacing.md }}
              accessibilityLabel={t('admin.moderation')}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="body">{t('admin.sendToReview')}</Text>
                <Badge label={String(overview.aiDraftsAwaitingReview)} tone="warning" />
              </View>
            </Card>
          ) : null}

          <Card style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body">{t('admin.applications')}</Text>
              <Badge label={String(overview.teacherApplicationsPending)} />
            </View>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body">{t('admin.moderation')}</Text>
              <Badge label={String(overview.openReports)} tone={overview.openReports > 0 ? 'danger' : 'neutral'} />
            </View>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body">{t('admin.activities')}</Text>
              <Text variant="body" color="muted">
                {overview.publishedActivities}
              </Text>
            </View>
          </Card>

          {isAdmin ? (
            <Card
              onPress={() => router.push('/(admin)/config')}
              style={{ marginTop: spacing.lg }}
              accessibilityLabel={t('admin.config')}
            >
              <Text variant="body">{t('admin.config')}</Text>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
