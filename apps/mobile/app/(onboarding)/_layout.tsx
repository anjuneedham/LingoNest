import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStackAnimation } from '@/hooks/useStackAnimation';

export default function OnboardingLayout() {
  const { theme } = useTheme();
  const animation = useStackAnimation();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        // Onboarding is a forward path; going back to re-answer is fine, but
        // gestures that skip steps are not.
        gestureEnabled: true,
        animation,
      }}
    />
  );
}
