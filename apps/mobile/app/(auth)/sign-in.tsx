import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase, isBackendConfigured } from '@/services/supabase';

export default function SignIn() {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace('/');
  };

  const inputStyle = {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    color: theme.text,
    marginBottom: spacing.md,
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text variant="display" align="center">
          {t('brand.name')}
        </Text>
        <Text variant="body" color="muted" align="center" style={{ marginBottom: spacing.xxl }}>
          {t('brand.tagline')}
        </Text>

        {!isBackendConfigured ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: theme.warningMuted,
              marginBottom: spacing.lg,
            }}
          >
            {/* Honest about the environment rather than failing mysteriously. */}
            <Text variant="small">
              {`${t('common.notConfigured')}: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY`}
            </Text>
          </View>
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          accessibilityLabel={t('auth.email')}
          style={[type('body'), inputStyle]}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          accessibilityLabel={t('auth.password')}
          style={[type('body'), inputStyle]}
        />

        {error ? (
          <Text variant="small" color="danger" style={{ marginBottom: spacing.md }}>
            {error}
          </Text>
        ) : null}

        <Button
          label={t('auth.signIn')}
          onPress={() => void signIn()}
          loading={busy}
          disabled={!email || !password || !isBackendConfigured}
          fullWidth
          size="large"
        />

        <Button
          label={t('auth.forgotPassword')}
          onPress={() => router.push('/(auth)/forgot-password')}
          variant="ghost"
          fullWidth
          style={{ marginTop: spacing.md }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
          <Text variant="small" color="muted">
            {`${t('auth.noAccount')} `}
          </Text>
          <Text
            variant="small"
            color="primary"
            onPress={() => router.push('/(auth)/sign-up')}
            accessibilityRole="link"
          >
            {t('auth.signUp')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
