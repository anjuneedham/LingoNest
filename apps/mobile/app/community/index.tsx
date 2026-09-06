import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Screen, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
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
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);

  const groupsQuery = useQuery({
    queryKey: ['community-groups', languageCode],
    queryFn: () => fetchCommunityGroups(languageCode),
  });

  const groups = groupsQuery.data?.ok ? groupsQuery.data.value : [];
  const busiestGroupId = groups.length > 0 ? [...groups].sort((a, b) => b.postCount - a.postCount)[0]!.id : null;

  return (
    <Screen
      loading={groupsQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="35%" height={22} />
          <Skeleton width="70%" height={13} style={{ marginTop: spacing.xs }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginTop: spacing.md, padding: spacing.lg }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="85%" height={13} style={{ marginTop: spacing.sm }} />
            </View>
          ))}
        </>
      }
      error={groupsQuery.data && !groupsQuery.data.ok ? groupsQuery.data.error : null}
      onRetry={() => void groupsQuery.refetch()}
      empty={groupsQuery.data?.ok && groups.length === 0 ? { title: t('community.noGroups') } : null}
    >
      <Text variant="title">{t('community.title')}</Text>
      <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
        {t('community.guidelines')}
      </Text>

      {groups.map((group, i) => {
        const isBusiest = group.id === busiestGroupId && group.postCount > 0;
        return (
          <Animated.View key={group.id} entering={FadeInDown.delay(i * 60)}>
            <Card
              onPress={() => router.push(`/community/${group.id}`)}
              raised={isBusiest}
              style={{
                marginTop: spacing.md,
                borderColor: isBusiest ? theme.primary : undefined,
                borderWidth: isBusiest ? 2 : 1,
              }}
            >
              <Text variant="subheading">{group.title}</Text>
              {group.description ? (
                <Text variant="body" color="muted" style={{ marginTop: spacing.xs }}>
                  {group.description}
                </Text>
              ) : null}
              <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
                {t('community.postCount', { count: group.postCount })}
              </Text>
            </Card>
          </Animated.View>
        );
      })}
    </Screen>
  );
}
