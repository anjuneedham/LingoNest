import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The entry route.
 *
 * Decides where a person lands: sign-in if they have no session, onboarding if
 * they have not finished it, and Home otherwise. Kept here rather than in a
 * guard on every screen so there is one place to reason about.
 */
export default function Index() {
  const { theme } = useTheme();
  const initialising = useSessionStore((s) => s.initialising);
  const session = useSessionStore((s) => s.session);
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode);

  useEffect(() => {
    if (initialising) return;

    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }

    // The profile row is created by a database trigger, so a brand-new account
    // may briefly have a session and no profile yet.
    if (!profile) return;

    const onboarded = Boolean(profile.onboardingCompletedAt) && Boolean(languageCode);
    router.replace(onboarded ? '/(tabs)' : '/(onboarding)/welcome');
  }, [initialising, session, profile, languageCode]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}
