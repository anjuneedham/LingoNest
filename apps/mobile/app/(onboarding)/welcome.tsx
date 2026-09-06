import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The first screen after signing up.
 *
 * States the product loop plainly — learn, practise, apply, connect — rather
 * than a slideshow. Someone who just signed up wants to start.
 */
export default function Welcome() {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const steps = [
    { glyph: '≡', title: t('learn.title'), body: t('learn.yourPath') },
    { glyph: '◎', title: t('practice.title'), body: t('practice.aiConversationBody') },
    { glyph: '☺', title: t('teachers.title'), body: t('practice.speakingBody') },
  ];

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="display" align="center">
          {t('onboarding.welcomeTitle')}
        </Text>
        <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.md }}>
          {t('onboarding.welcomeBody')}
        </Text>

        <View style={{ marginTop: spacing.xxl }}>
          {steps.map((step) => (
            <View
              key={step.title}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  backgroundColor: theme.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}
              >
                <Text variant="heading" color="primary">
                  {step.glyph}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{step.title}</Text>
                <Text variant="small" color="muted">
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Button
        label={t('common.continue')}
        onPress={() => router.push('/(onboarding)/language')}
        fullWidth
        size="large"
      />
    </Screen>
  );
}
