import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BRAND } from '@lingonest/core';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';

export default function ForgotPassword() {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${BRAND.scheme}://reset` });
    setBusy(false);
    // Always reports success: telling an anonymous caller whether an address is
    // registered would leak who has an account.
    setSent(true);
  };

  return (
    <Screen>
      <Text variant="title" style={{ marginBottom: spacing.lg }}>
        {t('auth.resetPassword')}
      </Text>

      {sent ? (
        <>
          <Text variant="body">{t('auth.resetSent')}</Text>
          <Button
            label={t('auth.signIn')}
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ marginTop: spacing.xl }}
          />
        </>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel={t('auth.email')}
            style={[
              type('body'),
              {
                minHeight: 52,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                color: theme.text,
              },
            ]}
          />
          <Button
            label={t('auth.resetPassword')}
            onPress={() => void send()}
            loading={busy}
            disabled={!email}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
        </>
      )}
    </Screen>
  );
}
