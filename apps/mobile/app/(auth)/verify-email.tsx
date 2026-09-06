import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { spacing } = useTheme();
  const { t } = useTranslation();

  return (
    <Screen scroll={false}>
      <Text variant="title" align="center" style={{ marginTop: spacing.xxxl }}>
        {t('auth.verifyEmail')}
      </Text>
      <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.md }}>
        {t('auth.verifySent', { email: email ?? '' })}
      </Text>
      <Button
        label={t('auth.signIn')}
        onPress={() => router.replace('/(auth)/sign-in')}
        style={{ marginTop: spacing.xl, alignSelf: 'center' }}
      />
    </Screen>
  );
}
