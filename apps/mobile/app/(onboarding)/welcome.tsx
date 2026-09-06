import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
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
    { glyph: '📚', title: t('learn.title'), body: t('learn.yourPath') },
    { glyph: '🎤', title: t('practice.title'), body: t('practice.aiConversationBody') },
    { glyph: '👨‍🏫', title: t('teachers.title'), body: t('practice.speakingBody') },
  ];

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View entering={FadeInDown.delay(100)}>
          <Text variant="display" align="center">
            {t('onboarding.welcomeTitle')}
          </Text>
          <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.md }}>
            {t('onboarding.welcomeBody')}
          </Text>
        </Animated.View>

        <View style={{ marginTop: spacing.xxl }}>
          {steps.map((step, idx) => (
            <Animated.View
              key={step.title}
              entering={FadeInUp.delay(200 + idx * 100)}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: radius.lg,
                  backgroundColor: theme.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}
              >
                <Text variant="heading">{step.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{step.title}</Text>
                <Text variant="small" color="muted">
                  {step.body}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View entering={FadeInUp.delay(500)}>
        <Button
          label={t('common.continue')}
          onPress={() => router.push('/(onboarding)/language')}
          fullWidth
          size="large"
        />
      </Animated.View>
    </Screen>
  );
}
