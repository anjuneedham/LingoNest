import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStackAnimation } from '@/hooks/useStackAnimation';

export default function AuthLayout() {
  const { theme } = useTheme();
  const animation = useStackAnimation();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation,
      }}
    />
  );
}
