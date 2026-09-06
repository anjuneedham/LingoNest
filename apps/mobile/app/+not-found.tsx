import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFound() {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <Screen scroll={false}>
      <Text variant="title" align="center" style={{ marginTop: spacing.xxxl }}>
        {t('common.somethingWentWrong')}
      </Text>
      <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.sm }}>
        {t('error.not_found')}
      </Text>
      <Button
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        style={{ marginTop: spacing.xl, alignSelf: 'center' }}
      />
    </Screen>
  );
}
