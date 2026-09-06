import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Without this layout, Expo Router falls back to a default header whose
 * title is the raw route pattern ("lesson/[lessonId]/index") rather than
 * anything a learner should see. `play` and `summary` build their own
 * headers, so the native one is redundant there rather than merely untitled.
 */
export default function LessonLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen name="play" options={{ headerShown: false }} />
      <Stack.Screen name="summary" options={{ headerShown: false }} />
    </Stack>
  );
}
