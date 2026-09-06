import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { useSessionStore } from '@/store/session';
import { useStackAnimation } from '@/hooks/useStackAnimation';

/**
 * The admin/CMS area.
 *
 * Gated on `admin`, `content_editor` or `moderator` — never rendered for
 * anyone else, so there is no admin-shaped screen to discover by guessing a
 * route. RLS enforces the same boundary again on every query this area makes,
 * so this check is a convenience, not the security boundary.
 */
export default function AdminLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const roles = useSessionStore((s) => s.roles);
  const initialising = useSessionStore((s) => s.initialising);
  const animation = useStackAnimation();

  if (initialising) return null;

  const canEnter = roles.some((role) => role === 'admin' || role === 'content_editor' || role === 'moderator');
  if (!canEnter) return <Redirect href="/(tabs)" />;

  const isAdmin = roles.includes('admin');
  const isContentEditor = isAdmin || roles.includes('content_editor');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        animation,
      }}
    >
      <Stack.Screen name="index" options={{ title: t('admin.title') }} />
      {isContentEditor ? (
        <>
          <Stack.Screen name="content/index" options={{ title: t('admin.content') }} />
          <Stack.Screen name="content/[lessonId]" options={{ title: '' }} />
          <Stack.Screen name="review-queue" options={{ title: t('admin.moderation') }} />
        </>
      ) : null}
      {isAdmin ? <Stack.Screen name="config/index" options={{ title: t('admin.config') }} /> : null}
    </Stack>
  );
}
