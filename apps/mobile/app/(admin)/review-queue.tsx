import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Card, Screen, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchReviewQueue } from '@/services/admin';

/**
 * Everything waiting on a human decision, oldest first.
 *
 * AI-drafted lessons cannot reach `published` without a recorded approval
 * (enforced in the database, `lessons_ai_review_guard`) — this screen is where
 * that approval actually gets recorded, not just a status label.
 */
export default function ReviewQueue() {
  const { spacing } = useTheme();
  const { t } = useTranslation();

  const queueQuery = useQuery({
    queryKey: ['admin-review-queue'],
    queryFn: fetchReviewQueue,
  });

  const items = queueQuery.data?.ok ? queueQuery.data.value : [];

  return (
    <Screen
      loading={queueQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="40%" height={22} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginTop: spacing.md, padding: spacing.lg }}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
            </View>
          ))}
        </>
      }
      error={queueQuery.data && !queueQuery.data.ok ? queueQuery.data.error : null}
      onRetry={() => void queueQuery.refetch()}
      empty={queueQuery.data?.ok && items.length === 0 ? { title: t('admin.reviewQueueEmpty') } : null}
    >
      <Text variant="title">{t('admin.moderation')}</Text>

      {items.map((item, i) => (
        <Animated.View key={item.id} entering={FadeInDown.delay(i * 60)}>
          <Card onPress={() => router.push(`/(admin)/content/${item.id}`)} style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text variant="body">{item.title}</Text>
                <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                  {item.unitTitle}
                  {item.generatedBy === 'ai' ? `  ·  ${t('admin.aiDraft')}` : ''}
                </Text>
              </View>
              <Badge label={t(`admin.status.${item.status}`)} tone={item.status === 'approved' ? 'success' : 'warning'} />
            </View>
          </Card>
        </Animated.View>
      ))}
    </Screen>
  );
}
