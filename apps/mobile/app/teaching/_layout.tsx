import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useSessionStore } from '@/store/session';

/**
 * The teacher area.
 *
 * The teacher-only screens are removed from the router tree when the role is
 * absent, rather than rendered and hidden. That is a convenience: RLS enforces
 * the same rules on every query, so a leaked route would show nothing. The
 * application route stays available to everyone, because that is how someone
 * becomes a teacher.
 */
export default function TeachingLayout() {
  const { theme } = useTheme();
  const roles = useSessionStore((s) => s.roles);
  const initialising = useSessionStore((s) => s.initialising);

  if (initialising) return null;

  const isTeacher = roles.includes('teacher');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="apply" options={{ title: '' }} />
      {isTeacher ? (
        <>
          <Stack.Screen name="index" options={{ title: '' }} />
          <Stack.Screen name="earnings" options={{ title: '' }} />
          <Stack.Screen name="schedule" options={{ title: '' }} />
          <Stack.Screen name="students/[learnerId]" options={{ title: '' }} />
        </>
      ) : null}
    </Stack>
  );
}
