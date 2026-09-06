import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  canJoinRoom,
  formatInZone,
  formatMoney,
  type BookingStatus,
  type Currency,
} from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { cancelBooking } from '@/services/marketplace';
import { findOrCreateBookingConversation } from '@/services/messages';
import { useSessionStore } from '@/store/session';
import { track } from '@/services/analytics';

/**
 * The learner's lessons.
 *
 * Cancelling shows the refund outcome first, computed by the same policy the
 * server applies, so the number on the confirmation is the number that happens.
 */
export default function Bookings() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select(
          'id, starts_at, duration_minutes, status, price_cents, currency, teacher_id, profiles!bookings_teacher_id_fkey(display_name)',
        )
        .eq('learner_id', profile!.id)
        .order('starts_at', { ascending: false })
        .limit(50);
      return (data ?? []) as BookingRow[];
    },
    enabled: Boolean(profile?.id),
  });

  async function message(booking: BookingRow) {
    if (!profile?.id) return;
    const result = await findOrCreateBookingConversation(profile.id, booking.teacher_id, booking.id);
    if (result.ok) router.push(`/messages/${result.value}`);
  }

  const bookings = bookingsQuery.data ?? [];
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => new Date(b.starts_at).getTime() > now && !b.status.startsWith('cancelled'),
  );
  const past = bookings.filter(
    (b) => new Date(b.starts_at).getTime() <= now || b.status.startsWith('cancelled'),
  );

  const confirmCancel = async (booking: BookingRow) => {
    setBusy(booking.id);
    // Ask the server what would happen before asking the learner to confirm.
    const preview = await cancelBooking(booking.id, undefined, true);
    setBusy(null);

    if (!preview.ok) {
      Alert.alert(t('common.somethingWentWrong'), t(preview.error.messageKey));
      return;
    }

    const refund = preview.value.outcome.refundMinor;
    const message =
      refund >= booking.price_cents
        ? t('booking.cancel.fullRefund')
        : refund > 0
          ? t('booking.cancel.partialRefund')
          : t('booking.cancel.noRefund');

    Alert.alert(t('booking.cancelTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('booking.cancel'),
        style: 'destructive',
        onPress: async () => {
          setBusy(booking.id);
          const result = await cancelBooking(booking.id);
          setBusy(null);
          if (result.ok) {
            track('booking_cancelled', {
              bookingId: booking.id,
              byRole: 'learner',
              hoursBefore: (new Date(booking.starts_at).getTime() - Date.now()) / 3_600_000,
            });
            await queryClient.invalidateQueries({ queryKey: ['bookings'] });
          }
        },
      },
    ]);
  };

  return (
    <Screen
      loading={bookingsQuery.isLoading}
      empty={
        !bookingsQuery.isLoading && bookings.length === 0
          ? {
              title: t('booking.noBookings'),
              body: t('booking.noBookingsBody'),
              actionLabel: t('teachers.title'),
              onAction: () => router.push('/(tabs)/teachers'),
            }
          : null
      }
      onRefresh={() => void bookingsQuery.refetch()}
      refreshing={bookingsQuery.isRefetching}
    >
      {upcoming.length > 0 ? (
        <>
          <Text variant="heading">{t('booking.upcoming')}</Text>
          {upcoming.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              timezone={profile?.timezone ?? 'UTC'}
              busy={busy === booking.id}
              onCancel={() => void confirmCancel(booking)}
              onMessage={() => void message(booking)}
            />
          ))}
        </>
      ) : null}

      {past.length > 0 ? (
        <>
          <Text variant="heading" style={{ marginTop: spacing.xl }}>
            {t('booking.past')}
          </Text>
          {past.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              timezone={profile?.timezone ?? 'UTC'}
              busy={false}
              onCancel={() => undefined}
              onMessage={() => void message(booking)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

interface BookingRow {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: BookingStatus;
  price_cents: number;
  currency: string;
  teacher_id: string;
  profiles: { display_name?: string } | null;
}

function BookingCard({
  booking,
  timezone,
  busy,
  onCancel,
  onMessage,
}: {
  booking: BookingRow;
  timezone: string;
  busy: boolean;
  onCancel: () => void;
  onMessage: () => void;
}) {
  const { spacing } = useTheme();
  const { t } = useTranslation();

  const startsAt = new Date(booking.starts_at).getTime();
  const joinable = canJoinRoom({
    startsAt,
    durationMinutes: booking.duration_minutes,
    status: booking.status,
  });
  const cancellable = booking.status === 'confirmed' && startsAt > Date.now();

  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="subheading">{booking.profiles?.display_name ?? ''}</Text>
          <Text variant="small" color="muted" style={{ marginTop: 2 }}>
            {formatInZone(startsAt, timezone)}
          </Text>
        </View>
        <Text variant="bodyStrong">
          {formatMoney(booking.price_cents, booking.currency as Currency)}
        </Text>
      </View>

      <Badge
        label={booking.status.replace(/_/g, ' ')}
        tone={
          booking.status === 'confirmed'
            ? 'success'
            : booking.status.startsWith('cancelled')
              ? 'danger'
              : 'neutral'
        }
        style={{ marginTop: spacing.sm }}
      />

      {joinable ? (
        <Button
          label={t('booking.join')}
          onPress={() => router.push(`/room/${booking.id}`)}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <Button
        label={t('messages.title')}
        onPress={onMessage}
        variant="ghost"
        fullWidth
        style={{ marginTop: spacing.sm }}
      />

      {cancellable ? (
        <Button
          label={t('booking.cancel')}
          onPress={onCancel}
          variant="ghost"
          loading={busy}
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </Card>
  );
}
