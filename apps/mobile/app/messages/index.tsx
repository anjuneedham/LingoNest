import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Screen, Text } from '@/components';
import { fetchConversations } from '@/services/messages';
import { useSessionStore } from '@/store/session';

/**
 * The inbox.
 *
 * Direct conversations start from a teacher's profile; a booking starts one
 * automatically so a minor learner can reach their teacher even where direct
 * messaging is not offered (brief §65).
 */
export default function Messages() {
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', profile?.id],
    queryFn: () => fetchConversations(profile!.id),
    enabled: Boolean(profile?.id),
  });

  const conversations = conversationsQuery.data?.ok ? conversationsQuery.data.value : [];

  return (
    <Screen
      loading={conversationsQuery.isLoading}
      error={conversationsQuery.data && !conversationsQuery.data.ok ? conversationsQuery.data.error : null}
      onRetry={() => void conversationsQuery.refetch()}
      empty={
        conversationsQuery.data?.ok && conversations.length === 0
          ? { title: t('messages.noConversations'), body: t('messages.noConversationsBody') }
          : null
      }
      onRefresh={() => void conversationsQuery.refetch()}
      refreshing={conversationsQuery.isRefetching}
    >
      <Text variant="title">{t('messages.title')}</Text>

      {conversations.map((conversation) => (
        <Card
          key={conversation.id}
          onPress={() => router.push(`/messages/${conversation.id}`)}
          style={{ marginTop: 12 }}
          accessibilityLabel={conversation.otherDisplayName}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="body">{conversation.otherDisplayName}</Text>
            {conversation.unread ? <Badge label="" tone="primary" glyph="●" /> : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
