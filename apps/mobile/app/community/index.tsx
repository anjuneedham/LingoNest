import React from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, Screen, Text } from '@/components';
import { fetchCommunityGroups } from '@/services/community';
import { useLearningStore } from '@/store/learning';

/**
 * Community groups.
 *
 * `community_groups_read`'s RLS policy already hides a group from a minor
 * account unless it was authored with `minors_allowed` — the list here is
 * exactly what the database is willing to show, not a client-side filter that
 * could be bypassed.
 */
export default function CommunityGroups() {
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);

  const groupsQuery = useQuery({
    queryKey: ['community-groups', languageCode],
    queryFn: () => fetchCommunityGroups(languageCode),
  });

  const groups = groupsQuery.data?.ok ? groupsQuery.data.value : [];

  return (
    <Screen
      loading={groupsQuery.isLoading}
      error={groupsQuery.data && !groupsQuery.data.ok ? groupsQuery.data.error : null}
      onRetry={() => void groupsQuery.refetch()}
      empty={groupsQuery.data?.ok && groups.length === 0 ? { title: t('community.noGroups') } : null}
    >
      <Text variant="title">{t('community.title')}</Text>
      <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
        {t('community.guidelines')}
      </Text>

      {groups.map((group) => (
        <Card key={group.id} onPress={() => router.push(`/community/${group.id}`)} style={{ marginTop: 12 }}>
          <Text variant="subheading">{group.title}</Text>
          {group.description ? (
            <Text variant="body" color="muted" style={{ marginTop: 4 }}>
              {group.description}
            </Text>
          ) : null}
          <Text variant="caption" color="muted" style={{ marginTop: 8 }}>
            {t('community.postCount', { count: group.postCount })}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
