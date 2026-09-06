import React from 'react';
import { Switch, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchFeatureFlags, fetchRemoteConfigRows, setFeatureFlag } from '@/services/admin';

/**
 * Configuration.
 *
 * Feature flags are toggled here because they are meant to change without a
 * release (brief §37, §69). Remote config values are shown read-only: they
 * are structured payloads validated by `@lingonest/core`'s
 * `remoteConfigSchema`, and editing pieces of a validated JSON blob one field
 * at a time in a mobile UI is how you end up shipping a corrupt payload — so
 * this screen shows what is live rather than guessing at a safe editor for it.
 */
export default function AdminConfig() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const flagsQuery = useQuery({ queryKey: ['admin-feature-flags'], queryFn: fetchFeatureFlags });
  const configQuery = useQuery({ queryKey: ['admin-remote-config'], queryFn: fetchRemoteConfigRows });

  const flags = flagsQuery.data?.ok ? flagsQuery.data.value : [];
  const configRows = configQuery.data?.ok ? configQuery.data.value : [];

  async function toggle(key: string, enabled: boolean) {
    const result = await setFeatureFlag(key, enabled);
    if (result.ok) {
      void queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    }
  }

  return (
    <Screen
      loading={flagsQuery.isLoading || configQuery.isLoading}
      error={flagsQuery.data && !flagsQuery.data.ok ? flagsQuery.data.error : null}
      onRetry={() => {
        void flagsQuery.refetch();
        void configQuery.refetch();
      }}
    >
      <Text variant="title">{t('admin.config')}</Text>

      <Text variant="subheading" style={{ marginTop: spacing.lg }}>
        {t('admin.featureFlags')}
      </Text>
      {flags.map((flag) => (
        <Card key={flag.key} style={{ marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text variant="body">{flag.key}</Text>
              {flag.description ? (
                <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                  {flag.description}
                </Text>
              ) : null}
            </View>
            <Switch
              value={flag.enabled}
              onValueChange={(value) => void toggle(flag.key, value)}
              trackColor={{ true: theme.primary, false: theme.border }}
            />
          </View>
        </Card>
      ))}

      <Text variant="subheading" style={{ marginTop: spacing.lg }}>
        {t('admin.remoteConfigTitle')}
      </Text>
      <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
        {t('admin.remoteConfigReadOnly')}
      </Text>
      {configRows.map((row) => (
        <Card key={row.key} style={{ marginTop: spacing.sm }}>
          <Text variant="body">{row.key}</Text>
          <Text variant="caption" color="muted" style={{ marginTop: 2 }} numberOfLines={3}>
            {JSON.stringify(row.value)}
          </Text>
          {row.updatedAt ? (
            <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
              {t('admin.updated')}: {new Date(row.updatedAt).toLocaleDateString()}
            </Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
