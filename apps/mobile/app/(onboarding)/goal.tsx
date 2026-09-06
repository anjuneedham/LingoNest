import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

const GOALS = [
  { minutes: 5, key: 'casual' },
  { minutes: 10, key: 'regular' },
  { minutes: 15, key: 'serious' },
  { minutes: 30, key: 'intense' },
] as const;

/**
 * The last onboarding step: a daily goal and, optionally, one reminder.
 *
 * Notification permission is asked for here with the reason stated, rather than
 * at launch before the learner knows what the app is.
 */
export default function ChooseGoal() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);

  const profile = useSessionStore((s) => s.profile);
  const loadProfile = useSessionStore((s) => s.loadProfile);
  const languageCode = useLearningStore((s) => s.languageCode);
  const variantCode = useLearningStore((s) => s.variantCode);
  const setDailyGoal = useLearningStore((s) => s.setDailyGoal);

  const finish = async (withReminders: boolean) => {
    if (!profile || !languageCode) return;
    setBusy(true);

    if (withReminders) {
      await Notifications.requestPermissionsAsync();
    }

    const { data: language } = await supabase
      .from('languages')
      .select('id')
      .eq('code', languageCode)
      .maybeSingle();

    if (language) {
      await supabase
        .from('user_languages')
        .update({ daily_goal_minutes: minutes })
        .eq('user_id', profile.id)
        .eq('language_id', language.id);
    }

    await supabase
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', profile.id);

    await supabase
      .from('notification_preferences')
      .update({
        review_reminders: withReminders,
        streak_reminders: withReminders,
        lesson_reminders: withReminders,
      })
      .eq('user_id', profile.id);

    setDailyGoal(minutes);
    await loadProfile();

    track('onboarding_completed', {
      languageCode,
      variantCode: variantCode ?? undefined,
      goalMinutes: minutes,
    });

    setBusy(false);
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <Text variant="title">{t('onboarding.goalTitle')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.sm }}>
        {t('onboarding.goalExplainer')}
      </Text>

      <View style={{ marginTop: spacing.xl }}>
        {GOALS.map((goal) => (
          <Card
            key={goal.key}
            onPress={() => setMinutes(goal.minutes)}
            style={{
              marginBottom: spacing.sm,
              borderWidth: 2,
              borderColor: minutes === goal.minutes ? theme.primary : theme.border,
            }}
            accessibilityLabel={t(`onboarding.goal.${goal.key}`)}
          >
            <Text variant="body">{t(`onboarding.goal.${goal.key}`)}</Text>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: spacing.xl }}>
        <Text variant="subheading">{t('onboarding.remindersTitle')}</Text>
        <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
          {t('onboarding.remindersBody')}
        </Text>
        <Button
          label={t('onboarding.finish')}
          onPress={() => void finish(true)}
          loading={busy}
          fullWidth
          size="large"
          style={{ marginTop: spacing.lg }}
        />
        <Button
          label={t('common.skip')}
          onPress={() => void finish(false)}
          variant="ghost"
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </Screen>
  );
}
