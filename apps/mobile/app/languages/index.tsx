import React from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { feedbackTap } from '@/services/feedback';

interface EnrolledLanguage {
  readonly code: string;
  readonly name: string;
  readonly nativeName: string;
  readonly variantCode: string | null;
}

/**
 * Languages.
 *
 * Onboarding only ever asks for one language, and until this screen existed
 * there was no way back to `(onboarding)/language` afterward — so a second
 * language a learner picked up there was permanently unreachable. Switching
 * here is purely local (nothing server-side reads `user_languages.is_active`
 * today); adding a new one reuses the same onboarding flow, which already
 * upserts on `(user_id, language_id)` rather than overwriting a language
 * you're already learning.
 */
export default function Languages() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const activeLanguageCode = useLearningStore((s) => s.languageCode);
  const setLanguage = useLearningStore((s) => s.setLanguage);

  const enrolledQuery = useQuery({
    queryKey: ['enrolled-languages', profile?.id],
    queryFn: async (): Promise<EnrolledLanguage[]> => {
      const { data } = await supabase
        .from('user_languages')
        .select('languages!inner(code, name, native_name), language_variants(code)')
        .eq('user_id', profile!.id);

      return (data ?? []).map((row) => {
        const language = row.languages as unknown as { code: string; name: string; native_name: string };
        const variant = row.language_variants as unknown as { code: string } | null;
        return {
          code: language.code,
          name: language.name,
          nativeName: language.native_name,
          variantCode: variant?.code ?? null,
        };
      });
    },
    enabled: Boolean(profile?.id),
  });

  const enrolled = enrolledQuery.data ?? [];

  return (
    <Screen loading={enrolledQuery.isLoading}>
      <Stack.Screen options={{ title: '' }} />
      <Text variant="title">{t('languages.title')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('languages.subtitle')}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        {enrolled.map((language) => {
          const isActive = language.code === activeLanguageCode;
          return (
            <Card
              key={language.code}
              onPress={
                isActive
                  ? undefined
                  : () => {
                      feedbackTap();
                      setLanguage(language.code, language.variantCode);
                      router.back();
                    }
              }
              raised={isActive}
              style={{
                marginBottom: spacing.md,
                borderColor: isActive ? theme.primary : undefined,
                borderWidth: isActive ? 2 : 1,
              }}
              accessibilityLabel={language.name}
              accessibilityHint={isActive ? undefined : t('languages.switchTo', { name: language.name })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text variant="subheading">{language.name}</Text>
                  <Text variant="small" color="muted" style={{ marginTop: 2 }}>
                    {language.nativeName}
                  </Text>
                </View>
                {isActive ? <Badge label={t('languages.current')} tone="primary" glyph="✓" /> : null}
              </View>
            </Card>
          );
        })}
      </View>

      <Button
        label={t('languages.addLanguage')}
        onPress={() => router.push('/(onboarding)/language')}
        variant="secondary"
        fullWidth
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}
