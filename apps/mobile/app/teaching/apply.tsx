import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TEACHER_SPECIALTIES } from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { supabase } from '@/services/supabase';
import { useSessionStore } from '@/store/session';
import { track } from '@/services/analytics';

/**
 * The teacher application.
 *
 * Submitting puts the application in the review queue; it does not make anyone
 * a teacher. Approval, verification and payout setup are three separate states,
 * and the screen says which one the applicant is in.
 */
export default function TeacherApplication() {
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [rate, setRate] = useState('25');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const existingQuery = useQuery({
    queryKey: ['teacher-application', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_applications')
        .select('id, status, submitted_at, review_notes')
        .eq('user_id', profile!.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(profile?.id),
  });

  const existing = existingQuery.data;

  const submit = async () => {
    if (!profile) return;
    setBusy(true);

    await supabase.from('teacher_applications').insert({
      user_id: profile.id,
      status: 'pending',
      payload: {
        headline,
        bio,
        experience,
        desiredHourlyRateCents: Math.round(Number(rate) * 100),
        specialties,
        country: profile.country,
        timezone: profile.timezone,
      },
    });

    track('teacher_application_submitted', {
      languages: 1,
      specialties: specialties.length,
    });

    setBusy(false);
    setSubmitted(true);
  };

  if (existingQuery.isLoading) return <Screen loading />;

  if (existing || submitted) {
    const status = (existing?.status ?? 'pending') as
      | 'pending'
      | 'under_review'
      | 'approved'
      | 'rejected'
      | 'suspended';

    return (
      <Screen>
        <Text variant="title">{t('teaching.apply')}</Text>
        <Card style={{ marginTop: spacing.lg }}>
          <Badge
            label={t(`teaching.applicationStatus.${status}`)}
            tone={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}
            glyph={status === 'approved' ? '✓' : '◷'}
          />
          {existing?.review_notes ? (
            <Text variant="small" color="muted" style={{ marginTop: spacing.md }}>
              {existing.review_notes}
            </Text>
          ) : null}
          {status === 'approved' ? (
            <Button
              label={t('teaching.payoutSetup')}
              onPress={() => router.replace('/teaching')}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
        </Card>
      </Screen>
    );
  }

  const inputStyle = {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    color: theme.text,
    marginBottom: spacing.md,
  };

  return (
    <Screen>
      <Text variant="title">{t('teaching.apply')}</Text>

      <TextInput
        value={headline}
        onChangeText={setHeadline}
        placeholder="A one-line introduction"
        placeholderTextColor={theme.textMuted}
        accessibilityLabel="Headline"
        style={[type('body'), inputStyle, { marginTop: spacing.lg }]}
      />

      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="Tell learners about yourself and how you teach"
        placeholderTextColor={theme.textMuted}
        multiline
        accessibilityLabel="Biography"
        style={[type('body'), inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
      />

      <TextInput
        value={experience}
        onChangeText={setExperience}
        placeholder="Teaching experience and qualifications"
        placeholderTextColor={theme.textMuted}
        multiline
        accessibilityLabel="Experience"
        style={[type('body'), inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
      />

      <Text variant="caption" color="muted" style={{ marginBottom: spacing.sm }}>
        {t('teachers.specialties')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {TEACHER_SPECIALTIES.map((specialty) => {
          const selected = specialties.includes(specialty);
          return (
            <Text
              key={specialty}
              onPress={() =>
                setSpecialties(
                  selected ? specialties.filter((s) => s !== specialty) : [...specialties, specialty],
                )
              }
              accessibilityRole="button"
              accessibilityState={{ selected }}
              variant="caption"
              color={selected ? 'primary' : 'muted'}
              style={{
                minHeight: MIN_TOUCH_TARGET - 12,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                margin: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: selected ? theme.primary : theme.border,
                overflow: 'hidden',
              }}
            >
              {specialty.replace(/_/g, ' ')}
            </Text>
          );
        })}
      </View>

      <TextInput
        value={rate}
        onChangeText={setRate}
        placeholder="25"
        placeholderTextColor={theme.textMuted}
        keyboardType="decimal-pad"
        accessibilityLabel="Desired hourly rate"
        style={[type('body'), inputStyle]}
      />
      <Text variant="caption" color="muted" style={{ marginTop: -spacing.sm, marginBottom: spacing.lg }}>
        {/* A suggestion, not a rule — teachers set their own price. */}
        Most teachers charge between $10 and $50 per lesson.
      </Text>

      <Button
        label={t('teaching.apply')}
        onPress={() => void submit()}
        loading={busy}
        disabled={!headline || !bio || specialties.length === 0}
        fullWidth
        size="large"
      />
    </Screen>
  );
}
