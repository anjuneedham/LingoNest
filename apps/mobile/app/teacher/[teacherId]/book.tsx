import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  describeRefund,
  formatInZone,
  formatMoney,
  groupSlotsByViewerDay,
  timeInZone,
  zoneLabel,
  type Currency,
  type Slot,
} from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { createBooking, fetchAvailability, fetchTeacher } from '@/services/marketplace';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * The booking flow.
 *
 * Both timezones are shown, because "6pm" means two different things to the two
 * people involved. The cancellation terms appear before payment rather than in
 * a confirmation email afterwards.
 */
export default function BookLesson() {
  const { teacherId } = useLocalSearchParams<{ teacherId: string }>();
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const languageCode = useLearningStore((s) => s.languageCode) ?? 'es';

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerZone = profile?.timezone ?? 'UTC';

  const teacherQuery = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => fetchTeacher(teacherId),
    enabled: Boolean(teacherId),
  });
  const teacher = teacherQuery.data?.ok ? teacherQuery.data.value : null;

  const slotsQuery = useQuery({
    queryKey: ['availability', teacherId],
    queryFn: () => {
      const from = new Date();
      const to = new Date(Date.now() + 14 * 86_400_000);
      return fetchAvailability(teacherId, from, to, 60);
    },
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });

  const days = useMemo(
    () => groupSlotsByViewerDay(slotsQuery.data ?? [], viewerZone),
    [slotsQuery.data, viewerZone],
  );

  const book = async () => {
    if (!selectedSlot || !teacher) return;
    setBusy(true);
    setError(null);

    track('booking_started', {
      teacherId: teacher.userId,
      priceCents: teacher.hourlyRateCents,
      currency: teacher.currency as Currency,
      isPackage: false,
    });

    const result = await createBooking({
      teacherId: teacher.userId,
      languageCode,
      startsAt: selectedSlot.startsAt,
      durationMinutes: 60,
      learnerNotes: notes || undefined,
    });

    setBusy(false);

    if (!result.ok) {
      setError(t(result.error.messageKey, { defaultValue: t('error.unknown') }));
      return;
    }

    if (result.value.requiresPayment && result.value.clientSecret) {
      // Payment is completed with the Stripe SDK using this client secret; the
      // booking only becomes confirmed when the webhook says the charge
      // succeeded. Nothing here marks it paid.
      router.push({
        pathname: '/bookings',
        params: { pendingPaymentFor: result.value.booking.id },
      });
      return;
    }

    track('booking_completed', {
      teacherId: teacher.userId,
      bookingId: result.value.booking.id,
      priceCents: result.value.booking.price_cents,
      currency: result.value.booking.currency as Currency,
      isPackage: true,
    });
    router.replace('/bookings');
  };

  const refundNote = describeRefund(
    selectedSlot ? (selectedSlot.startsAt - Date.now()) / 3_600_000 : 48,
  );

  return (
    <Screen
      loading={teacherQuery.isLoading || slotsQuery.isLoading}
      empty={
        !slotsQuery.isLoading && days.length === 0
          ? {
              title: t('teachers.noResults'),
              body: t('teaching.availabilityEmpty'),
              actionLabel: t('common.back'),
              onAction: () => router.back(),
            }
          : null
      }
    >
      <Text variant="title">{t('booking.pickTime')}</Text>
      {teacher ? (
        <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
          {`${teacher.displayName} · ${t('booking.teacherTime', {
            zone: zoneLabel(Date.now(), teacher.timezone),
          })}`}
        </Text>
      ) : null}

      {days.slice(0, 7).map((day) => (
        <View key={day.date} style={{ marginTop: spacing.lg }}>
          <Text variant="caption" color="muted">
            {formatInZone(new Date(`${day.date}T12:00:00Z`).getTime(), viewerZone, 'en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {day.slots.map((slot) => {
              const selected = selectedSlot?.startsAt === slot.startsAt;
              return (
                <Pressable
                  key={slot.startsAt}
                  onPress={() => setSelectedSlot(slot)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={timeInZone(slot.startsAt, viewerZone)}
                  style={{
                    minHeight: MIN_TOUCH_TARGET,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.lg,
                    marginRight: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 2,
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primaryMuted : theme.surface,
                  }}
                >
                  <Text variant="body" color={selected ? 'primary' : 'default'}>
                    {timeInZone(slot.startsAt, viewerZone)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}

      {selectedSlot && teacher ? (
        <Card style={{ marginTop: spacing.xl }}>
          <Text variant="caption" color="muted">
            {t('booking.yourTime')}
          </Text>
          <Text variant="subheading" style={{ marginTop: 2 }}>
            {formatInZone(selectedSlot.startsAt, viewerZone)}
          </Text>
          {/* The teacher's local time too — one of them is always confused otherwise. */}
          <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
            {`${t('booking.teacherTime', { zone: zoneLabel(selectedSlot.startsAt, teacher.timezone) })}: ${timeInZone(
              selectedSlot.startsAt,
              teacher.timezone,
            )}`}
          </Text>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('booking.notesLabel')}
            placeholderTextColor={theme.textMuted}
            multiline
            accessibilityLabel={t('booking.notesLabel')}
            style={[
              type('body'),
              {
                minHeight: 80,
                marginTop: spacing.lg,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.background,
                color: theme.text,
                textAlignVertical: 'top',
              },
            ]}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            <Text variant="bodyStrong">{t('booking.total')}</Text>
            <Text variant="bodyStrong">
              {formatMoney(teacher.hourlyRateCents, teacher.currency as Currency)}
            </Text>
          </View>

          <Badge label={t(refundNote.messageKey)} glyph="ℹ" style={{ marginTop: spacing.md }} />

          {error ? (
            <Text variant="small" color="danger" style={{ marginTop: spacing.md }}>
              {error}
            </Text>
          ) : null}

          <Button
            label={t('booking.payAndBook')}
            onPress={() => void book()}
            loading={busy}
            fullWidth
            size="large"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
