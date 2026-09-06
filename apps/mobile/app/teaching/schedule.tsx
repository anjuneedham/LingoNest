import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The teacher's weekly availability.
 *
 * Hours are stored in the teacher's own timezone with the zone recorded on the
 * row, so a daylight-saving change moves the UTC instant and leaves their
 * working day where they put it.
 */
export default function Schedule() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ['availability-rules', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_availability')
        .select('id, weekday, start_time, end_time, timezone')
        .eq('teacher_id', profile!.id)
        .order('weekday');
      return data ?? [];
    },
    enabled: Boolean(profile?.id),
  });

  const rules = rulesQuery.data ?? [];

  const addRule = async (weekday: number) => {
    if (!profile) return;
    setBusy(true);
    await supabase.from('teacher_availability').insert({
      teacher_id: profile.id,
      weekday,
      start_time: '18:00',
      end_time: '21:00',
      timezone: profile.timezone,
    });
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
  };

  const removeRule = async (id: string) => {
    setBusy(true);
    await supabase.from('teacher_availability').delete().eq('id', id);
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
  };

  return (
    <Screen loading={rulesQuery.isLoading}>
      <Text variant="title">{t('teaching.availability')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {`${t('booking.teacherTime', { zone: profile?.timezone ?? 'UTC' })}`}
      </Text>

      {rules.length === 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="body" color="muted">
            {t('teaching.availabilityEmpty')}
          </Text>
        </Card>
      ) : null}

      {WEEKDAYS.map((day, weekday) => {
        const dayRules = rules.filter((rule) => rule.weekday === weekday);
        return (
          <Card key={day} style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="subheading">{day}</Text>
              <Button
                label="+"
                onPress={() => void addRule(weekday)}
                variant="ghost"
                size="small"
                loading={busy}
                accessibilityLabel={`Add hours on ${day}`}
              />
            </View>

            {dayRules.map((rule) => (
              <View
                key={rule.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                  marginTop: spacing.sm,
                }}
              >
                <Badge label={`${rule.start_time.slice(0, 5)} – ${rule.end_time.slice(0, 5)}`} glyph="◷" />
                <Text
                  variant="caption"
                  color="danger"
                  onPress={() => void removeRule(rule.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${rule.start_time} on ${day}`}
                >
                  {t('common.close')}
                </Text>
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
