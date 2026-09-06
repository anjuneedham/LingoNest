import React from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Card, LevelPill, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
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

      {scenarios.map((scenario) => (
        <Card
          key={scenario.key}
          onPress={() => router.push(`/practice/conversation/${scenario.key}`)}
          style={{ marginTop: spacing.md }}
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
      ))}
    </Screen>
  );
}
