import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Screen, Text } from '@/components';
import { fetchReviewQueue } from '@/services/admin';

/**
 * Everything waiting on a human decision, oldest first.
 *
 * AI-drafted lessons cannot reach `published` without a recorded approval
 * (enforced in the database, `lessons_ai_review_guard`) — this screen is where
 * that approval actually gets recorded, not just a status label.
 */
export default function ReviewQueue() {
  const { t } = useTranslation();

  const queueQuery = useQuery({
    queryKey: ['admin-review-queue'],
    queryFn: fetchReviewQueue,
  });

  const items = queueQuery.data?.ok ? queueQuery.data.value : [];

  return (
    <Screen
      loading={queueQuery.isLoading}
      error={queueQuery.data && !queueQuery.data.ok ? queueQuery.data.error : null}
      onRetry={() => void queueQuery.refetch()}
      empty={queueQuery.data?.ok && items.length === 0 ? { title: t('admin.reviewQueueEmpty') } : null}
    >
      <Text variant="title">{t('admin.moderation')}</Text>

      {items.map((item) => (
        <Card key={item.id} onPress={() => router.push(`/(admin)/content/${item.id}`)} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text variant="body">{item.title}</Text>
              <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                {item.unitTitle}
                {item.generatedBy === 'ai' ? `  ·  ${t('admin.aiDraft')}` : ''}
              </Text>
            </View>
            <Badge label={t(`admin.status.${item.status}`)} tone={item.status === 'approved' ? 'success' : 'warning'} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
