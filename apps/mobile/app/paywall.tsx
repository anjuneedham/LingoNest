import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { annualSavingBps, formatMoney, planPrice, type BillingInterval, type Currency, type Plan } from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/api';
import { track } from '@/services/analytics';

/**
 * The paywall.
 *
 * Prices come from `subscription_plans`, so changing them is a data change
 * (brief §37). What each plan includes is read from the same entitlements the
 * server enforces, so the list cannot drift from what is actually granted.
 */
export default function Paywall() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const [interval, setInterval] = useState<BillingInterval>('year');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('code, name_key, description_key, tier, prices, entitlements, trial_days')
        .eq('active', true)
        .order('tier');
      return (data ?? []) as PlanRow[];
    },
  });

  const plans = (plansQuery.data ?? []).filter((plan) => plan.code !== 'free');
  const currency: Currency = 'USD';

  const subscribe = async (planCode: string) => {
    setBusy(planCode);
    setError(null);

    track('paywall_viewed', { source: 'paywall', plan: planCode as never });

    const result = await callFunction<{ url: string }>('stripe-checkout', {
      planCode,
      interval,
      currency,
      successUrl: 'lingonest://paywall?status=success',
      cancelUrl: 'lingonest://paywall?status=cancelled',
    });

    setBusy(null);

    if (!result.ok) {
      setError(t(result.error.messageKey, { defaultValue: t('error.unknown') }));
      return;
    }
    // Opening the provider's checkout; the webhook is what grants the plan.
    router.push(result.value.url as never);
  };

  return (
    <Screen loading={plansQuery.isLoading}>
      <Text variant="title">{t('paywall.title')}</Text>
      <Text variant="body" color="muted" style={{ marginTop: spacing.xs }}>
        {t('paywall.subtitle')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {(['month', 'year'] as const).map((option) => (
          <Text
            key={option}
            onPress={() => setInterval(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: interval === option }}
            variant="small"
            color={interval === option ? 'primary' : 'muted'}
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: interval === option ? theme.primary : theme.border,
              overflow: 'hidden',
            }}
          >
            {t(`paywall.${option === 'month' ? 'monthly' : 'yearly'}`)}
          </Text>
        ))}
      </View>

      {plans.map((row) => {
        const plan: Plan = {
          code: row.code as never,
          nameKey: row.name_key,
          descriptionKey: row.description_key,
          prices: row.prices as never,
          entitlements: row.entitlements as never,
          trialDays: row.trial_days,
        };
        const price = planPrice(plan, currency, interval);
        const saving = annualSavingBps(plan, currency);

        return (
          <Card key={row.code} style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading">{t(row.name_key)}</Text>
              {interval === 'year' && saving > 0 ? (
                <Badge
                  label={t('paywall.saveWithYearly', { percent: Math.round(saving / 100) })}
                  tone="success"
                />
              ) : null}
            </View>

            <Text variant="body" color="muted" style={{ marginTop: spacing.xs }}>
              {t(row.description_key)}
            </Text>

            <Text variant="display" style={{ marginTop: spacing.md }}>
              {formatMoney(price.amountMinor, price.currency)}
            </Text>
            <Text variant="caption" color="muted">
              {interval === 'month' ? t('paywall.perMonth', { price: '' }) : t('paywall.perYear', { price: '' })}
            </Text>

            <View style={{ marginTop: spacing.lg }}>
              {featureList(row.entitlements as Record<string, unknown>, t as unknown as Translate).map((feature) => (
                <Text key={feature} variant="small" style={{ marginTop: spacing.xs }}>
                  {`✓  ${feature}`}
                </Text>
              ))}
            </View>

            <Button
              label={
                row.trial_days > 0
                  ? t('paywall.startTrial', { days: row.trial_days })
                  : t('paywall.subscribe')
              }
              onPress={() => void subscribe(row.code)}
              loading={busy === row.code}
              fullWidth
              size="large"
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        );
      })}

      {error ? (
        <Text variant="small" color="danger" align="center" style={{ marginTop: spacing.lg }}>
          {error}
        </Text>
      ) : null}

      <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing.xl }}>
        {t('paywall.terms')}
      </Text>
    </Screen>
  );
}

interface PlanRow {
  code: string;
  name_key: string;
  description_key: string;
  tier: number;
  prices: unknown;
  entitlements: unknown;
  trial_days: number;
}

/** Built from the entitlements the server enforces, not a hand-written list. */
type Translate = (key: string, params?: Record<string, unknown>) => string;

function featureList(entitlements: Record<string, unknown>, t: Translate): string[] {
  const features: string[] = [];
  if (entitlements.dailyLessonLimit === null) features.push(t('paywall.feature.unlimitedLessons'));
  if (entitlements.aiConversationsPerMonth === null) {
    features.push(t('paywall.feature.aiUnlimited'));
  } else if (typeof entitlements.aiConversationsPerMonth === 'number') {
    features.push(t('paywall.feature.aiConversations', { count: entitlements.aiConversationsPerMonth }));
  }
  if (entitlements.speakingPractice) features.push(t('paywall.feature.speaking'));
  if (entitlements.advancedReview) features.push(t('paywall.feature.advancedReview'));
  if (entitlements.offlineDownloads) features.push(t('paywall.feature.offline'));
  if (entitlements.adFree) features.push(t('paywall.feature.adFree'));
  if (entitlements.aiStudyCoach) features.push(t('paywall.feature.coach'));
  if (entitlements.learningReports) features.push(t('paywall.feature.reports'));
  if (typeof entitlements.tutorDiscountBps === 'number' && entitlements.tutorDiscountBps > 0) {
    features.push(t('paywall.feature.tutorDiscount', { percent: entitlements.tutorDiscountBps / 100 }));
  }
  return features;
}
