import React from 'react';
import { Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { IMMERSION_LEVELS } from '@lingonest/core';
import { Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { textScales, type TextScale } from '@/theme/tokens';
import { useSettingsStore, type Appearance } from '@/store/settings';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { supabase } from '@/services/supabase';

/**
 * Settings.
 *
 * Accessibility options are first-class here rather than deferred to the
 * operating system, and every privacy toggle says what it actually does
 * (brief §62, §64).
 */
export default function Settings() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const settings = useSettingsStore();
  const immersion = useLearningStore((s) => s.immersionPercent);
  const setImmersion = useLearningStore((s) => s.setImmersion);

  const Row = ({
    label,
    body,
    right,
  }: {
    label: string;
    body?: string;
    right: React.ReactNode;
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text variant="body">{label}</Text>
        {body ? (
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {body}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  const Choice = <T extends string>({
    options,
    value,
    onChange,
    labelFor,
  }: {
    options: readonly T[];
    value: T;
    onChange: (next: T) => void;
    labelFor: (option: T) => string;
  }) => (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {options.map((option) => (
        <Text
          key={option}
          onPress={() => onChange(option)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option }}
          variant="caption"
          color={value === option ? 'primary' : 'muted'}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: value === option ? theme.primary : theme.border,
            overflow: 'hidden',
          }}
        >
          {labelFor(option)}
        </Text>
      ))}
    </View>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <Text variant="title">{t('settings.title')}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color="muted">
          {t('settings.accessibility')}
        </Text>

        <Row
          label={t('settings.appearance')}
          right={
            <Choice<Appearance>
              options={['system', 'light', 'dark']}
              value={settings.appearance}
              onChange={settings.setAppearance}
              labelFor={(option) => t(`settings.appearance${option[0]!.toUpperCase()}${option.slice(1)}`)}
            />
          }
        />

        <Row
          label={t('settings.textSize')}
          right={
            <Choice<TextScale>
              options={Object.keys(textScales) as TextScale[]}
              value={settings.textScale}
              onChange={settings.setTextScale}
              labelFor={(option) => option[0]!.toUpperCase()}
            />
          }
        />

        <Row
          label={t('settings.highContrast')}
          body={t('settings.highContrastBody')}
          right={
            <Switch
              value={settings.highContrast}
              onValueChange={settings.setHighContrast}
              accessibilityLabel={t('settings.highContrast')}
            />
          }
        />

        <Row
          label={t('settings.reduceMotion')}
          right={
            <Switch
              value={settings.reduceMotion}
              onValueChange={settings.setReduceMotion}
              accessibilityLabel={t('settings.reduceMotion')}
            />
          }
        />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color="muted">
          {t('practice.title')}
        </Text>

        <Row
          label={t('settings.autoPlayAudio')}
          right={
            <Switch
              value={settings.autoPlayAudio}
              onValueChange={settings.setAutoPlayAudio}
              accessibilityLabel={t('settings.autoPlayAudio')}
            />
          }
        />

        <Row
          label={t('settings.soundEffects')}
          right={
            <Switch
              value={settings.soundEffectsEnabled}
              onValueChange={settings.setSoundEffects}
              accessibilityLabel={t('settings.soundEffects')}
            />
          }
        />

        <Row
          label={t('settings.haptics')}
          right={
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={settings.setHaptics}
              accessibilityLabel={t('settings.haptics')}
            />
          }
        />

        <Row
          label={t('settings.listeningSpeed')}
          right={
            <Choice
              options={['slow', 'normal', 'natural'] as const}
              value={settings.listeningSpeed}
              onChange={settings.setListeningSpeed}
              labelFor={(option) => option}
            />
          }
        />

        <Row
          label={t('settings.immersion')}
          body={t('settings.immersionBody')}
          right={
            <Choice
              options={IMMERSION_LEVELS.map(String) as string[]}
              value={String(immersion)}
              onChange={(next) => setImmersion(Number(next))}
              labelFor={(option) => (option === '0' ? t('settings.immersionOff') : `${option}%`)}
            />
          }
        />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color="muted">
          {t('settings.privacy')}
        </Text>

        <Row
          label={t('settings.keepRecordings')}
          body={t('settings.keepRecordingsBody')}
          right={
            <Switch
              value={settings.keepRecordings}
              onValueChange={settings.setKeepRecordings}
              accessibilityLabel={t('settings.keepRecordings')}
            />
          }
        />

        <Row
          label={t('settings.analyticsConsent')}
          body={t('settings.analyticsBody')}
          right={
            <Switch
              value={profile?.analyticsConsent ?? true}
              onValueChange={(value) => {
                if (profile) {
                  void supabase.from('profiles').update({ analytics_consent: value }).eq('id', profile.id);
                }
              }}
              accessibilityLabel={t('settings.analyticsConsent')}
            />
          }
        />

        <Row
          label={t('settings.deleteAccount')}
          body={t('settings.deleteAccountBody')}
          right={
            <Text variant="caption" color="danger" accessibilityRole="button">
              {t('settings.deleteConfirm')}
            </Text>
          }
        />
      </Card>
    </Screen>
  );
}
