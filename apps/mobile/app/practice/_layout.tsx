import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStackAnimation } from '@/hooks/useStackAnimation';

export default function PracticeLayout() {
  const { theme } = useTheme();
  const animation = useStackAnimation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        animation,
      }}
    />
  );
}
