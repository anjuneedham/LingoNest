import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Without this layout, the header falls back to the raw route pattern.
 * Every screen here already shows its own heading in-body, so the header
 * just needs the back chevron with no duplicate title text.
 */
export default function CommunityLayout() {
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
      <Stack.Screen name="[groupId]" options={{ title: '' }} />
      <Stack.Screen name="post/[postId]" options={{ title: '' }} />
    </Stack>
  );
}
