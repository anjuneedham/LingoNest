import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * Language selection.
 *
 * The list comes from the database, so a new language appears here when its
 * content is published — no app release involved (brief §74).
 */
export default function ChooseLanguage() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const setLanguage = useLearningStore((s) => s.setLanguage);
  const profile = useSessionStore((s) => s.profile);

  const languagesQuery = useQuery({
    queryKey: ['languages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('languages')
        .select('code, name, native_name, ordinal')
        .order('ordinal');
      return data ?? [];
    },
    staleTime: 10 * 60_000,
  });

  // A returning learner adding a second language shouldn't be offered one
  // they're already enrolled in — first-time onboarding has no rows here yet,
  // so this is a no-op for that case.
  const enrolledQuery = useQuery({
    queryKey: ['enrolled-language-codes', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_languages')
        .select('languages!inner(code)')
        .eq('user_id', profile!.id);
      return new Set((data ?? []).map((row) => (row.languages as unknown as { code: string }).code));
    },
    enabled: Boolean(profile?.id),
  });

  const enrolledCodes = enrolledQuery.data ?? new Set<string>();
  const allLanguages = languagesQuery.data ?? [];
  const languages = allLanguages.filter((language) => !enrolledCodes.has(language.code));
  const loading = languagesQuery.isLoading || enrolledQuery.isLoading;
  const allEnrolled = enrolledCodes.size > 0 && allLanguages.length > 0 && languages.length === 0;

  return (
    <Screen
      loading={loading}
      empty={
        !loading && languages.length === 0
          ? allEnrolled
            ? { title: t('languages.allEnrolled'), actionLabel: t('common.back'), onAction: () => router.back() }
            : { title: t('error.content_unavailable') }
          : null
      }
    >
      <Text variant="title">{t('onboarding.chooseLanguage')}</Text>

      <View style={{ marginTop: spacing.xl }}>
        {languages.map((language) => (
          <Card
            key={language.code}
            onPress={() => {
              setLanguage(language.code, null);
              track('language_selected', { languageCode: language.code });
              router.push('/(onboarding)/variant');
            }}
            style={{ marginBottom: spacing.md }}
            accessibilityLabel={language.name}
          >
            <Text variant="subheading">{language.name}</Text>
            <Text variant="small" color="muted" style={{ marginTop: 2 }}>
              {language.native_name}
            </Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
