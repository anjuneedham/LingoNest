import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Screen, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { PRACTICE_MODE_COLORS } from '@/theme/practiceModes';
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
  const { theme, spacing } = useTheme();
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
      badge: undefined,
      minutes: 5,
      color: PRACTICE_MODE_COLORS.conversation,
      isPriority: false,
    },
    {
      key: 'review',
      title: t('practice.review'),
      body: dueCount > 0 ? t('practice.reviewBody', { count: dueCount }) : t('practice.noneDue'),
      route: '/practice/review',
      glyph: '↻',
      badge: dueCount > 0 ? String(dueCount) : undefined,
      minutes: 10,
      color: PRACTICE_MODE_COLORS.review,
      isPriority: dueCount > 0,
    },
    {
      key: 'speaking',
      title: t('practice.speaking'),
      body: t('practice.speakingBody'),
      route: '/practice/speaking',
      glyph: '🎙',
      badge: undefined,
      minutes: 8,
      color: PRACTICE_MODE_COLORS.speaking,
      isPriority: false,
    },
    {
      key: 'listening',
      title: t('practice.listening'),
      body: t('practice.listeningBody'),
      route: '/practice/listening',
      glyph: '🎧',
      badge: undefined,
      minutes: 7,
      color: PRACTICE_MODE_COLORS.listening,
      isPriority: false,
    },
    {
      key: 'writing',
      title: t('practice.writing'),
      body: t('practice.writingBody'),
      route: '/practice/writing',
      glyph: '✎',
      badge: undefined,
      minutes: 6,
      color: PRACTICE_MODE_COLORS.writing,
      isPriority: false,
    },
    {
      key: 'mistakes',
      title: t('practice.mistakes'),
      body: topMistake
        ? t(topMistake.reasonKey, topMistake.reasonParams)
        : t('practice.mistakesBody'),
      route: '/practice/mistakes',
      glyph: '⚠',
      badge: undefined,
      minutes: 5,
      color: PRACTICE_MODE_COLORS.mistakes,
      isPriority: Boolean(topMistake),
    },
    {
      key: 'quick',
      title: t('practice.quick'),
      body: t('practice.quickBody'),
      route: '/practice/quick',
      glyph: '⚡',
      badge: undefined,
      minutes: 2,
      color: PRACTICE_MODE_COLORS.quick,
      isPriority: false,
    },
  ] as const;

  const sortedOptions = [...options].sort((a, b) => {
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return 0;
  });

  return (
    <Screen
      loading={snapshotQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="30%" height={22} />
          <Skeleton width="70%" height={13} style={{ marginTop: spacing.xs }} />
          <View style={{ marginTop: spacing.lg }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: spacing.md,
                  padding: spacing.lg,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Skeleton width={48} height={48} radius={12} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="85%" height={12} style={{ marginTop: spacing.xs }} />
                </View>
              </View>
            ))}
          </View>
        </>
      }
    >
      <Text variant="title">{t('practice.title')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('practice.chooseMode') || 'Pick a practice mode to improve your skills'}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        {sortedOptions.map((option) => (
          <Card
            key={option.key}
            onPress={() => router.push(option.route)}
            raised={option.isPriority}
            style={{
              marginBottom: spacing.md,
              borderLeftWidth: 4,
              borderLeftColor: option.color,
            }}
            accessibilityLabel={option.title}
            accessibilityHint={option.body}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: option.color + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}
              >
                <Text variant="heading">{option.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant={option.isPriority ? 'bodyStrong' : 'subheading'}>
                    {option.title}
                  </Text>
                  {option.isPriority && option.badge ? (
                    <Badge label={option.badge} tone="danger" glyph="⭐" />
                  ) : null}
                </View>
                <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
                  {option.body}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="caption" color="muted">
                  {option.minutes}m
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
