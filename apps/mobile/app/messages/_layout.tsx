import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * `index` has no title of its own, so without this layout the header falls
 * back to the raw route pattern. `[conversationId]` sets its own dynamic
 * title in-component (the other person's name); the empty default here is
 * just what shows before that data loads.
 */
export default function MessagesLayout() {
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
      <Stack.Screen name="[conversationId]" options={{ title: '' }} />
    </Stack>
  );
}
