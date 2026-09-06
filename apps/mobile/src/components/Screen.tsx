import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '@/theme/ThemeProvider';
import type { AppError } from '@lingonest/core';

/**
 * The screen wrapper.
 *
 * `loading`, `error` and `empty` are part of the contract rather than optional
 * extras: a screen that forgets one of them is the blank page the brief rules
 * out (§89). Passing `error` renders a retry state; passing `empty` renders an
 * empty state with an action.
 */

export interface EmptyState {
  readonly title: string;
  readonly body?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly icon?: React.ReactNode;
}

interface ScreenProps {
  readonly children?: React.ReactNode;
  readonly loading?: boolean;
  readonly error?: AppError | null;
  readonly empty?: EmptyState | null;
  readonly onRetry?: () => void;
  readonly onRefresh?: () => void;
  readonly refreshing?: boolean;
  readonly scroll?: boolean;
  readonly padded?: boolean;
  readonly edges?: readonly Edge[];
  readonly testID?: string;
}

export function Screen({
  children,
  loading = false,
  error = null,
  empty = null,
  onRetry,
  onRefresh,
  refreshing = false,
  scroll = true,
  padded = true,
  edges = ['top', 'left', 'right'],
  testID,
}: ScreenProps) {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();

  const container = [styles.fill, { backgroundColor: theme.background }];
  const contentPadding = padded ? { padding: spacing.lg } : undefined;

  if (loading) {
    return (
      <SafeAreaView style={container} edges={edges} testID={testID}>
        <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text variant="small" color="muted" style={{ marginTop: spacing.md }}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={container} edges={edges} testID={testID}>
        <View style={[styles.centered, contentPadding]}>
          <Text variant="heading" align="center">
            {t('common.somethingWentWrong')}
          </Text>
          <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.sm }}>
            {t(error.messageKey, { defaultValue: t('error.unknown') })}
          </Text>
          {error.detail ? (
            <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing.xs }}>
              {error.detail}
            </Text>
          ) : null}
          {error.retryable && onRetry ? (
            <Button label={t('common.tryAgain')} onPress={onRetry} style={{ marginTop: spacing.lg }} />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (empty) {
    return (
      <SafeAreaView style={container} edges={edges} testID={testID}>
        <View style={[styles.centered, contentPadding]}>
          {empty.icon}
          <Text variant="heading" align="center" style={{ marginTop: spacing.md }}>
            {empty.title}
          </Text>
          {empty.body ? (
            <Text variant="body" color="muted" align="center" style={{ marginTop: spacing.sm }}>
              {empty.body}
            </Text>
          ) : null}
          {empty.actionLabel && empty.onAction ? (
            <Button label={empty.actionLabel} onPress={empty.onAction} style={{ marginTop: spacing.lg }} />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (!scroll) {
    return (
      <SafeAreaView style={container} edges={edges} testID={testID}>
        <View style={[styles.fill, contentPadding]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={container} edges={edges} testID={testID}>
      <ScrollView
        contentContainerStyle={[contentPadding, { paddingBottom: spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
