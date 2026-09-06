import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatMoney, type Currency } from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/api';
import { useSessionStore } from '@/store/session';

/**
 * Earnings and payout setup.
 *
 * "Approved" and "able to be paid" are separate states, and this screen names
 * exactly what the payment provider still needs rather than saying "pending".
 */
export default function Earnings() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const [busy, setBusy] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const earningsQuery = useQuery({
    queryKey: ['earnings', profile?.id],
    queryFn: async () => {
      const [{ data: balance }, { data: payouts }] = await Promise.all([
        supabase
          .from('teacher_balances')
          .select('pending_cents, available_cents, lifetime_cents, currency')
          .eq('teacher_id', profile!.id)
          .maybeSingle(),
        supabase
          .from('payouts')
          .select('id, amount_cents, currency, status, created_at')
          .eq('teacher_id', profile!.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      return { balance, payouts: payouts ?? [] };
    },
    enabled: Boolean(profile?.id),
  });

  const data = earningsQuery.data;
  const currency = (data?.balance?.currency ?? 'USD') as Currency;

  const setUpPayouts = async () => {
    setBusy(true);
    setError(null);
    const result = await callFunction<OnboardingState>('stripe-connect', {
      refreshUrl: 'lingonest://teaching/earnings',
      returnUrl: 'lingonest://teaching/earnings',
    });
    setBusy(false);

    if (!result.ok) {
      setError(t(result.error.messageKey, { defaultValue: t('error.unknown') }));
      return;
    }
    setOnboarding(result.value);
  };

  return (
    <Screen loading={earningsQuery.isLoading}>
      <Text variant="title">{t('teaching.earnings')}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text variant="caption" color="muted">
              {t('teaching.pending')}
            </Text>
            <Text variant="heading">
              {formatMoney(data?.balance?.pending_cents ?? 0, currency)}
            </Text>
          </View>
          <View>
            <Text variant="caption" color="muted">
              {t('teaching.available')}
            </Text>
            <Text variant="heading" color="success">
              {formatMoney(data?.balance?.available_cents ?? 0, currency)}
            </Text>
          </View>
        </View>
        <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
          {t('teaching.pendingExplainer')}
        </Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="subheading">{t('teaching.payoutSetup')}</Text>

        {onboarding ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Badge
                label={onboarding.chargesEnabled ? 'charges ✓' : 'charges pending'}
                tone={onboarding.chargesEnabled ? 'success' : 'warning'}
              />
              <Badge
                label={onboarding.payoutsEnabled ? 'payouts ✓' : 'payouts pending'}
                tone={onboarding.payoutsEnabled ? 'success' : 'warning'}
              />
            </View>
            {onboarding.requirementsDue.length > 0 ? (
              <Text variant="small" color="muted" style={{ marginTop: spacing.md }}>
                {t('teaching.payoutIncomplete', { items: onboarding.requirementsDue.join(', ') })}
              </Text>
            ) : null}
          </>
        ) : null}

        {error ? (
          <Text variant="small" color="danger" style={{ marginTop: spacing.md }}>
            {error}
          </Text>
        ) : null}

        <Button
          label={t('teaching.payoutSetup')}
          onPress={() => void setUpPayouts()}
          loading={busy}
          fullWidth
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      {(data?.payouts ?? []).length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="caption" color="muted">
            {t('teaching.payout')}
          </Text>
          {(data?.payouts ?? []).map((payout) => (
            <View
              key={payout.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <Text variant="small">
                {new Date(payout.created_at).toLocaleDateString()}
              </Text>
              <Text variant="small">
                {formatMoney(payout.amount_cents, payout.currency as Currency)}
              </Text>
              <Badge label={payout.status} tone={payout.status === 'paid' ? 'success' : 'neutral'} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

interface OnboardingState {
  onboardingUrl: string;
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
}
