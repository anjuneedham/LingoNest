import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { track } from '@/services/analytics';

/**
 * Sign-up.
 *
 * Date of birth is collected because it decides the safety rules that apply to
 * the account, and the screen says so rather than asking for it silently
 * (brief §65). Whether someone is a minor is then derived server-side by a
 * database trigger, never asserted by the client.
 */
export default function SignUp() {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMinor = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
    const born = new Date(dateOfBirth);
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    return born > eighteen;
  })();

  const [guardianEmail, setGuardianEmail] = useState('');

  const passwordProblem = password.length > 0 && password.length < 8 ? t('auth.passwordTooShort') : null;

  const signUp = async () => {
    setError(null);
    setBusy(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (authError) {
      setBusy(false);
      setError(authError.message);
      return;
    }

    // The profile row exists by now (created by trigger); fill in the details
    // the trigger cannot know.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          date_of_birth: dateOfBirth || null,
          guardian_email: isMinor ? guardianEmail || null : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .eq('id', sessionData.session.user.id);
    }

    track('signup_completed', { method: 'email' });
    setBusy(false);
    router.replace(sessionData.session ? '/(onboarding)/welcome' : '/(auth)/verify-email');
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
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text variant="title" style={{ marginBottom: spacing.xl }}>
          {t('auth.signUp')}
        </Text>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('auth.displayName')}
          placeholderTextColor={theme.textMuted}
          autoComplete="name"
          accessibilityLabel={t('auth.displayName')}
          style={[type('body'), inputStyle]}
        />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          accessibilityLabel={t('auth.email')}
          style={[type('body'), inputStyle]}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel={t('auth.password')}
          style={[type('body'), inputStyle]}
        />
        {passwordProblem ? (
          <Text variant="caption" color="danger" style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
            {passwordProblem}
          </Text>
        ) : null}

        <TextInput
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textMuted}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={t('auth.dateOfBirth')}
          style={[type('body'), inputStyle]}
        />
        <Text variant="caption" color="muted" style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
          {t('auth.dateOfBirthWhy')}
        </Text>

        {isMinor ? (
          <View>
            <TextInput
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              placeholder={t('auth.guardianEmail')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel={t('auth.guardianEmail')}
              style={[type('body'), inputStyle]}
            />
            <Text variant="caption" color="muted" style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
              {t('auth.guardianWhy')}
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text variant="small" color="danger" style={{ marginBottom: spacing.md }}>
            {error}
          </Text>
        ) : null}

        <Button
          label={t('auth.signUp')}
          onPress={() => void signUp()}
          loading={busy}
          disabled={!email || password.length < 8 || !displayName || (isMinor && !guardianEmail)}
          fullWidth
          size="large"
        />

        <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing.lg }}>
          {t('auth.termsAgreement')}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
