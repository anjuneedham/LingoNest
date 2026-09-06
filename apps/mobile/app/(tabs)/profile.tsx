import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SKILLS } from '@lingonest/core';
import { Badge, Button, Card, LevelPill, Screen, SkillRadar, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchHomeSnapshot } from '@/services/learner';
import { useSessionStore } from '@/store/session';
import { useLearningStore } from '@/store/learning';

/**
 * Profile.
 *
 * The nine-skill breakdown is the centrepiece rather than a single number,
 * because an uneven profile is the honest picture and the one that makes the
 * app's advice specific (brief §12, §60).
 */
export default function ProfileScreen() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const profile = useSessionStore((s) => s.profile);
  const signOut = useSessionStore((s) => s.signOut);
  const languageCode = useLearningStore((s) => s.languageCode);

  const snapshotQuery = useQuery({
    queryKey: ['home', profile?.id, languageCode],
    queryFn: () => fetchHomeSnapshot(profile!.id, languageCode!),
    enabled: Boolean(profile?.id && languageCode),
  });

  const snapshot = snapshotQuery.data?.ok ? snapshotQuery.data.value : null;

  return (
    <Screen loading={snapshotQuery.isLoading}>
      <Text variant="title">{profile?.displayName ?? ''}</Text>

      {snapshot ? (
        <>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="subheading">{snapshot.languageName}</Text>
              <LevelPill level={snapshot.levels.overall ?? null} showEstimatedLabel />
            </View>

            <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
              {t('cefr.notCertification')}
            </Text>

            <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
              <SkillRadar levels={snapshot.levels} />
            </View>

            <View style={{ marginTop: spacing.lg }}>
              {SKILLS.map((skill) => (
                <View
                  key={skill}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text variant="body">{t(`skills.${skill}`)}</Text>
                  <LevelPill level={snapshot.levels[skill] ?? null} size="small" />
                </View>
              ))}
            </View>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge
                label={t('home.streakDays', { count: snapshot.streak.current })}
                tone="streak"
                glyph="▲"
              />
              <Badge label={t('common.words', { count: snapshot.dueVocabularyCount })} glyph="↻" />
            </View>
          </Card>
        </>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <Button
          label={t('teaching.apply')}
          onPress={() => router.push('/teaching/apply')}
          variant="secondary"
          fullWidth
        />
        <Button
          label={t('booking.upcoming')}
          onPress={() => router.push('/bookings')}
          variant="ghost"
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
        <Button
          label={t('settings.title')}
          onPress={() => router.push('/settings')}
          variant="ghost"
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
        <Button
          label={t('auth.signOut')}
          onPress={() => void signOut()}
          variant="ghost"
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </Screen>
  );
}
