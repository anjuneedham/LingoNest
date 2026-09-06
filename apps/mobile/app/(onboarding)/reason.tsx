import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { LearningGoal } from '@lingonest/core';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

const REASONS: LearningGoal[] = ['travel', 'work', 'family', 'exam', 'culture', 'school', 'moving', 'curiosity'];

/**
 * Why the learner is here.
 *
 * Not a survey question: the answer changes which scenarios the AI practice
 * offers and which vocabulary the recommendation engine prioritises.
 */
export default function ChooseReason() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LearningGoal | null>(null);
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);
  const variantCode = useLearningStore((s) => s.variantCode);

  const save = async () => {
    if (!profile || !languageCode || !selected) return;

    const { data: language } = await supabase
      .from('languages')
      .select('id')
      .eq('code', languageCode)
      .maybeSingle();
    const { data: variant } = variantCode
      ? await supabase.from('language_variants').select('id').eq('code', variantCode).maybeSingle()
      : { data: null };

    if (language) {
      await supabase.from('user_languages').upsert(
        {
          user_id: profile.id,
          language_id: language.id,
          variant_id: variant?.id ?? null,
          goal: selected,
          is_active: true,
        },
        { onConflict: 'user_id,language_id' },
      );
    }

    router.push('/(onboarding)/level');
  };

  return (
    <Screen>
      <Text variant="title">{t('onboarding.whyLearning')}</Text>

      <View style={{ marginTop: spacing.xl }}>
        {REASONS.map((reason) => (
          <Card
            key={reason}
            onPress={() => setSelected(reason)}
            style={{
              marginBottom: spacing.sm,
              borderColor: selected === reason ? theme.primary : theme.border,
              borderWidth: 2,
            }}
            accessibilityLabel={t(`onboarding.reason.${reason}`)}
          >
            <Text variant="body">{t(`onboarding.reason.${reason}`)}</Text>
          </Card>
        ))}
      </View>

      <Button
        label={t('common.continue')}
        onPress={() => void save()}
        disabled={!selected}
        fullWidth
        size="large"
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}
