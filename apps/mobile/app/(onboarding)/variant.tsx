import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useLearningStore } from '@/store/learning';

/**
 * Regional variant.
 *
 * The explainer matters: choosing es-MX does not lock the learner out of Spain,
 * it decides which words and accent come first. Presenting one country's usage
 * as the language is exactly what the brief rules out (§27, §28).
 */
export default function ChooseVariant() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);
  const setLanguage = useLearningStore((s) => s.setLanguage);

  const variantsQuery = useQuery({
    queryKey: ['variants', languageCode],
    queryFn: async () => {
      const { data } = await supabase
        .from('language_variants')
        .select('code, label, region, is_default, languages!inner(code)')
        .eq('languages.code', languageCode!);
      return data ?? [];
    },
    enabled: Boolean(languageCode),
  });

  const variants = variantsQuery.data ?? [];

  const choose = (code: string) => {
    setLanguage(languageCode!, code);
    router.push('/(onboarding)/reason');
  };

  return (
    <Screen loading={variantsQuery.isLoading}>
      <Text variant="title">{t('onboarding.chooseVariant')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.sm }}>
        {t('onboarding.variantExplainer')}
      </Text>

      <View style={{ marginTop: spacing.xl }}>
        {variants.map((variant) => (
          <Card
            key={variant.code}
            onPress={() => choose(variant.code)}
            style={{ marginBottom: spacing.md }}
            accessibilityLabel={variant.label}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text variant="subheading">{variant.label}</Text>
                <Text variant="caption" color="muted">
                  {variant.region}
                </Text>
              </View>
              {variant.is_default ? (
                <Text variant="caption" color="primary">
                  ✦
                </Text>
              ) : null}
            </View>
          </Card>
        ))}
      </View>

      {variants.length === 0 && !variantsQuery.isLoading ? (
        <Button
          label={t('common.continue')}
          onPress={() => router.push('/(onboarding)/reason')}
          fullWidth
        />
      ) : null}
    </Screen>
  );
}
