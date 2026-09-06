import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Card, LevelPill, Screen, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { PRACTICE_MODE_COLORS } from '@/theme/practiceModes';
import { supabase } from '@/services/supabase';
import { useLearningStore } from '@/store/learning';
import { parseCefr } from '@lingonest/core';

/** Scenario picker for AI conversation practice. */
export default function ConversationList() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);

  const scenariosQuery = useQuery({
    queryKey: ['scenarios', languageCode],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversation_scenarios')
        .select('key, title, setting, partner_role, cefr, goals, languages!inner(code)')
        .eq('languages.code', languageCode!)
        .order('cefr');
      return data ?? [];
    },
    enabled: Boolean(languageCode),
  });

  const scenarios = scenariosQuery.data ?? [];

  return (
    <Screen
      loading={scenariosQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="50%" height={22} />
          <Skeleton width="80%" height={13} style={{ marginTop: spacing.xs }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginTop: spacing.md, padding: spacing.lg }}>
              <Skeleton width={48} height={20} radius={999} />
              <Skeleton width="60%" height={16} style={{ marginTop: spacing.sm }} />
              <Skeleton width="80%" height={12} style={{ marginTop: spacing.xs }} />
            </View>
          ))}
        </>
      }
      empty={
        !scenariosQuery.isLoading && scenarios.length === 0
          ? { title: t('error.content_unavailable') }
          : null
      }
    >
      <Text variant="title">{t('practice.aiConversation')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('practice.aiConversationBody')}
      </Text>

      {scenarios.map((scenario, i) => (
        <Animated.View key={scenario.key} entering={FadeInDown.delay(i * 60)}>
          <Card
            onPress={() => router.push(`/practice/conversation/${scenario.key}`)}
            style={{
              marginTop: spacing.md,
              borderLeftWidth: 4,
              borderLeftColor: PRACTICE_MODE_COLORS.conversation,
            }}
            accessibilityLabel={scenario.title}
          >
            <LevelPill level={parseCefr(scenario.cefr)} size="small" />
            <Text variant="subheading" style={{ marginTop: spacing.sm }}>
              {scenario.title}
            </Text>
            <Text variant="small" color="muted" style={{ marginTop: 2 }}>
              {scenario.setting}
            </Text>
            <Badge label={scenario.partner_role} glyph="☺" style={{ marginTop: spacing.sm }} />
          </Card>
        </Animated.View>
      ))}
    </Screen>
  );
}
