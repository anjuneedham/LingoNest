import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { SelfReport } from '@lingonest/core';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { track } from '@/services/analytics';
import { useLearningStore } from '@/store/learning';

const OPTIONS: SelfReport[] = ['never', 'a_little', 'some', 'confident'];

/**
 * Self-report, then an offer to check it properly.
 *
 * The self-report only decides where the adaptive placement *starts*; it is not
 * the level. A learner who says "I know a few words" but answers A2 questions
 * correctly will be placed at A2 (brief §30).
 */
export default function ChooseLevel() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<SelfReport | null>(null);
  const languageCode = useLearningStore((s) => s.languageCode);

  return (
    <Screen>
      <Text variant="title">{t('onboarding.levelQuestion')}</Text>

      <View style={{ marginTop: spacing.xl }}>
        {OPTIONS.map((option) => (
          <Card
            key={option}
            onPress={() => setSelected(option)}
            raised={selected === option}
            style={{
              marginBottom: spacing.sm,
              borderWidth: 2,
              borderColor: selected === option ? theme.primary : theme.border,
              backgroundColor: selected === option ? theme.primaryMuted : undefined,
            }}
            accessibilityLabel={t(`onboarding.level.${option}`)}
          >
            <Text variant="body">{t(`onboarding.level.${option}`)}</Text>
          </Card>
        ))}
      </View>

      {selected ? (
        <View style={{ marginTop: spacing.xl }}>
          {selected === 'never' ? (
            <Button
              label={t('common.continue')}
              onPress={() => {
                track('placement_skipped', { languageCode: languageCode ?? '' });
                router.push('/(onboarding)/goal');
              }}
              fullWidth
              size="large"
            />
          ) : (
            <>
              <Button
                label={t('onboarding.placementOffer')}
                onPress={() =>
                  router.push({ pathname: '/(onboarding)/placement', params: { selfReport: selected } })
                }
                fullWidth
                size="large"
              />
              <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing.sm }}>
                {t('onboarding.placementExplainer')}
              </Text>
              <Button
                label={t('onboarding.placementSkip')}
                onPress={() => {
                  track('placement_skipped', { languageCode: languageCode ?? '' });
                  router.push('/(onboarding)/goal');
                }}
                variant="ghost"
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
