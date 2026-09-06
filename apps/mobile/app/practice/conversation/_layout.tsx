import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Nested one level below practice/_layout.tsx, which doesn't set per-screen
 * titles — without this, the header falls back to the raw route pattern.
 */
export default function ConversationLayout() {
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
      <Stack.Screen name="[scenarioKey]" options={{ title: '' }} />
    </Stack>
  );
}
