import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  commissionBpsFor,
  formatInZone,
  formatMoney,
  summariseEarnings,
  type Currency,
} from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';

/**
 * The teacher dashboard.
 *
 * Shows today, the money, and the students — and states the commission rate and
 * the next tier plainly, because a teacher deciding whether to take a lesson
 * should not have to work out what they will actually be paid.
 */
export default function TeacherDashboard() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);

  const dashboardQuery = useQuery({
    queryKey: ['teaching-dashboard', profile?.id],
    queryFn: async () => {
      const [{ data: teacher }, { data: balance }, { data: bookings }, { data: tiers }] =
        await Promise.all([
          supabase
            .from('teachers')
            .select('user_id, status, rating_avg, rating_count, lessons_taught, currency, payout_enabled, commission_override_bps')
            .eq('user_id', profile!.id)
            .maybeSingle(),
          supabase
            .from('teacher_balances')
            .select('pending_cents, available_cents, lifetime_cents, currency')
            .eq('teacher_id', profile!.id)
            .maybeSingle(),
          supabase
            .from('bookings')
            .select('id, starts_at, duration_minutes, status, learner_id, profiles!bookings_learner_id_fkey(display_name)')
            .eq('teacher_id', profile!.id)
            .gte('starts_at', new Date(Date.now() - 3_600_000).toISOString())
            .order('starts_at', { ascending: true })
            .limit(10),
          supabase
            .from('commission_tiers')
            .select('min_lessons, max_lessons, bps')
            .eq('active', true)
            .order('min_lessons'),
        ]);

      return { teacher, balance, bookings: bookings ?? [], tiers: tiers ?? [] };
    },
    enabled: Boolean(profile?.id),
  });

  const data = dashboardQuery.data;
  const teacher = data?.teacher;

  if (!dashboardQuery.isLoading && !teacher) {
    return (
      <Screen
        empty={{
          title: t('teaching.apply'),
          actionLabel: t('teaching.apply'),
          onAction: () => router.push('/teaching/apply'),
        }}
      />
    );
  }

  const tiers = (data?.tiers ?? []).map((tier) => ({
    minLessons: tier.min_lessons,
    maxLessons: tier.max_lessons,
    bps: tier.bps,
  }));

  const commissionBps =
    teacher?.commission_override_bps ?? commissionBpsFor(teacher?.lessons_taught ?? 0, tiers);

  const summary = summariseEarnings({
    pendingMinor: data?.balance?.pending_cents ?? 0,
    availableMinor: data?.balance?.available_cents ?? 0,
    lifetimeMinor: data?.balance?.lifetime_cents ?? 0,
    thisMonthMinor: 0,
    currency: (data?.balance?.currency ?? teacher?.currency ?? 'USD') as Currency,
    lessonsThisMonth: 0,
    lessonsTaught: teacher?.lessons_taught ?? 0,
    tiers,
  });

  return (
    <Screen
      loading={dashboardQuery.isLoading}
      onRefresh={() => void dashboardQuery.refetch()}
      refreshing={dashboardQuery.isRefetching}
    >
      <Text variant="title">{t('teaching.dashboard')}</Text>

      {teacher && !teacher.payout_enabled ? (
        <Card style={{ marginTop: spacing.lg, borderColor: theme.warning, borderWidth: 2 }}>
          <Badge label={t('teaching.payoutSetup')} tone="warning" glyph="!" />
          <Text variant="body" style={{ marginTop: spacing.sm }}>
            {t('teaching.payoutRequired')}
          </Text>
          <Button
            label={t('teaching.payoutSetup')}
            onPress={() => router.push('/teaching/earnings')}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color="muted">
          {t('teaching.earnings')}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
          <View>
            <Text variant="caption" color="muted">
              {t('teaching.pending')}
            </Text>
            <Text variant="subheading">
              {formatMoney(summary.pendingMinor, summary.currency)}
            </Text>
          </View>
          <View>
            <Text variant="caption" color="muted">
              {t('teaching.available')}
            </Text>
            <Text variant="subheading" color="success">
              {formatMoney(summary.availableMinor, summary.currency)}
            </Text>
          </View>
        </View>

        <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
          {t('teaching.pendingExplainer')}
        </Text>

        <View
          style={{
            marginTop: spacing.lg,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <Text variant="small">
            {t('teaching.commissionRate', { percent: (commissionBps / 100).toFixed(0) })}
          </Text>
          {summary.nextTierAtLessons !== null && summary.nextTierBps !== null ? (
            <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
              {t('teaching.nextTier', {
                count: summary.nextTierAtLessons - (teacher?.lessons_taught ?? 0),
                percent: (summary.nextTierBps / 100).toFixed(0),
              })}
            </Text>
          ) : null}
        </View>
      </Card>

      <Text variant="heading" style={{ marginTop: spacing.xl }}>
        {t('teaching.todaySchedule')}
      </Text>

      {(data?.bookings ?? []).length === 0 ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="body" color="muted">
            {t('teaching.noLessonsToday')}
          </Text>
        </Card>
      ) : (
        (data?.bookings ?? []).map((booking) => {
          const learner = booking.profiles as unknown as { display_name?: string } | null;
          return (
            <Card
              key={booking.id}
              onPress={() => router.push(`/teaching/students/${booking.learner_id}`)}
              style={{ marginTop: spacing.md }}
              accessibilityLabel={learner?.display_name ?? ''}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="subheading">{learner?.display_name ?? ''}</Text>
                <Text variant="small" color="muted">
                  {formatInZone(new Date(booking.starts_at).getTime(), profile?.timezone ?? 'UTC')}
                </Text>
              </View>
              <Button
                label={t('booking.join')}
                onPress={() => router.push(`/room/${booking.id}`)}
                variant="secondary"
                size="small"
                style={{ marginTop: spacing.md }}
              />
            </Card>
          );
        })
      )}

      <Button
        label={t('teaching.setAvailability')}
        onPress={() => router.push('/teaching/schedule')}
        variant="secondary"
        fullWidth
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
