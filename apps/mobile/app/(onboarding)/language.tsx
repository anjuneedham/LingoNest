import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
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

  const languages = languagesQuery.data ?? [];

  return (
    <Screen
      loading={languagesQuery.isLoading}
      empty={
        !languagesQuery.isLoading && languages.length === 0
          ? { title: t('error.content_unavailable') }
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
