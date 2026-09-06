import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchHomeSnapshot } from '@/services/learner';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

/**
 * Practice.
 *
 * Every card says why it is being suggested — "3 recent errors with the
 * preterite", not "practise grammar" (brief §58, §96).
 */
export default function Practice() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);

  const snapshotQuery = useQuery({
    queryKey: ['home', profile?.id, languageCode],
    queryFn: () => fetchHomeSnapshot(profile!.id, languageCode!),
    enabled: Boolean(profile?.id && languageCode),
  });

  const snapshot = snapshotQuery.data?.ok ? snapshotQuery.data.value : null;
  const dueCount = snapshot?.dueVocabularyCount ?? 0;
  const topMistake = snapshot?.recommendations.find((r) => r.id.startsWith('mistake:'));

  const options = [
    {
      key: 'conversation',
      title: t('practice.aiConversation'),
      body: t('practice.aiConversationBody'),
      route: '/practice/conversation',
      glyph: '💬',
    },
    {
      key: 'review',
      title: t('practice.review'),
      body: dueCount > 0 ? t('practice.reviewBody', { count: dueCount }) : t('practice.noneDue'),
      route: '/practice/review',
      glyph: '↻',
      badge: dueCount > 0 ? String(dueCount) : undefined,
    },
    {
      key: 'speaking',
      title: t('practice.speaking'),
      body: t('practice.speakingBody'),
      route: '/practice/speaking',
      glyph: '🎙',
    },
    {
      key: 'listening',
      title: t('practice.listening'),
      body: t('practice.listeningBody'),
      route: '/practice/listening',
      glyph: '🎧',
    },
    {
      key: 'writing',
      title: t('practice.writing'),
      body: t('practice.writingBody'),
      route: '/practice/writing',
      glyph: '✎',
    },
    {
      key: 'mistakes',
      title: t('practice.mistakes'),
      body: topMistake
        ? t(topMistake.reasonKey, topMistake.reasonParams)
        : t('practice.mistakesBody'),
      route: '/practice/mistakes',
      glyph: '⚠',
    },
    {
      key: 'quick',
      title: t('practice.quick'),
      body: t('practice.quickBody'),
      route: '/practice/quick',
      glyph: '⚡',
    },
  ] as const;

  return (
    <Screen loading={snapshotQuery.isLoading}>
      <Text variant="title">{t('practice.title')}</Text>

      <View style={{ marginTop: spacing.lg }}>
        {options.map((option) => (
          <Card
            key={option.key}
            onPress={() => router.push(option.route)}
            style={{ marginBottom: spacing.md }}
            accessibilityLabel={option.title}
            accessibilityHint={option.body}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text variant="heading" style={{ marginRight: spacing.md }}>
                {option.glyph}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{option.title}</Text>
                <Text variant="small" color="muted" style={{ marginTop: 2 }}>
                  {option.body}
                </Text>
              </View>
              {'badge' in option && option.badge ? (
                <Badge label={option.badge} tone="primary" />
              ) : null}
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
