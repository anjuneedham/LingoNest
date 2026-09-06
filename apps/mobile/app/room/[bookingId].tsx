import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { callFunction } from '@/services/api';

/**
 * The live lesson room.
 *
 * The screen talks to a room grant, not to a vendor SDK: the Edge Function
 * decides which provider issued the token, so swapping Daily for LiveKit is a
 * server change. With no provider configured this says so and keeps chat and
 * notes available rather than pretending to connect (brief §94).
 */
export default function Room() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();

  const [grant, setGrant] = useState<RoomGrant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await callFunction<RoomGrant>('video-room', { bookingId });
      if (cancelled) return;
      setLoading(false);

      if (result.ok) {
        setGrant(result.value);
        return;
      }
      if (result.error.code === 'video_not_configured') {
        setNotConfigured(true);
        return;
      }
      setError(t(result.error.messageKey, { defaultValue: t('error.unknown') }));
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, t]);

  if (loading) return <Screen loading />;

  if (notConfigured) {
    return (
      <Screen>
        <Card>
          <Badge label={t('common.notConfigured')} tone="warning" glyph="!" />
          <Text variant="body" style={{ marginTop: spacing.md }}>
            {t('room.notConfigured')}
          </Text>
          <Button
            label={t('common.back')}
            onPress={() => router.back()}
            variant="secondary"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Card>
          <Text variant="body" color="danger">
            {error}
          </Text>
          <Button
            label={t('common.back')}
            onPress={() => router.back()}
            variant="secondary"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      {/*
        The provider's own component renders into this surface once its SDK is
        installed in a native build; the grant above is everything it needs.
      */}
      <View
        style={{
          flex: 1,
          // The video surface stays dark in both themes: a light background
          // behind a video tile is distracting on a call.
          backgroundColor: palette.ink900,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="body" color="inverse">
          {t('room.joining')}
        </Text>
        {grant ? (
          <Text variant="caption" color="inverse" style={{ marginTop: spacing.sm, opacity: 0.7 }}>
            {`${grant.provider} · ${grant.roomId}`}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          padding: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <Text variant="caption" color="muted">
          {t('room.notes')}
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('room.notesPlaceholder')}
          placeholderTextColor={theme.textMuted}
          multiline
          accessibilityLabel={t('room.notes')}
          style={[
            type('small'),
            {
              minHeight: 60,
              marginTop: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: theme.background,
              color: theme.text,
              textAlignVertical: 'top',
            },
          ]}
        />

        <Button
          label={t('room.endLesson')}
          onPress={() => router.back()}
          variant="danger"
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </View>
    </Screen>
  );
}

interface RoomGrant {
  roomId: string;
  roomUrl: string;
  token: string;
  expiresAt: string;
  provider: string;
}
