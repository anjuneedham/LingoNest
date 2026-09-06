import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

/**
 * Mistake review.
 *
 * Lists what the learner actually keeps getting wrong, ordered by how often,
 * and links each one to somewhere it can be fixed. This is the screen that
 * makes the mistake tracking worth collecting.
 */
export default function MistakeReview() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);

  const mistakesQuery = useQuery({
    queryKey: ['mistakes', profile?.id, languageCode],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_mistakes')
        .select('id, tag, label, skill, count, last_seen_at, target_kind, target_id, languages!inner(code)')
        .eq('user_id', profile!.id)
        .eq('languages.code', languageCode!)
        .is('resolved_at', null)
        .order('count', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: Boolean(profile?.id && languageCode),
  });

  const mistakes = mistakesQuery.data ?? [];

  return (
    <Screen
      loading={mistakesQuery.isLoading}
      empty={
        !mistakesQuery.isLoading && mistakes.length === 0
          ? {
              title: t('practice.noneDue'),
              actionLabel: t('common.back'),
              onAction: () => router.back(),
            }
          : null
      }
    >
      <Text variant="title">{t('practice.mistakes')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('practice.mistakesBody')}
      </Text>

      {mistakes.map((mistake) => (
        <Card key={mistake.id} style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">{mistake.label}</Text>
              <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                {t('recommend.mistake.reason', { topic: mistake.label, count: mistake.count })}
              </Text>
            </View>
            <Badge label={t(`skills.${mistake.skill}`)} tone="warning" glyph="⚠" />
          </View>

          <Button
            label={t('practice.quick')}
            onPress={() => router.push('/practice/quick')}
            variant="secondary"
            size="small"
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ))}
    </Screen>
  );
}
