import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatMoney, packageSavingBps, type Currency } from '@lingonest/core';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { fetchTeacher } from '@/services/marketplace';

/**
 * A teacher's public profile.
 *
 * Badges are rendered from verification records only. Where a teacher has none,
 * the page says so plainly rather than leaving an ambiguous gap (brief §84).
 */
export default function TeacherProfile() {
  const { teacherId } = useLocalSearchParams<{ teacherId: string }>();
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();

  const teacherQuery = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => fetchTeacher(teacherId),
    enabled: Boolean(teacherId),
  });

  const result = teacherQuery.data;
  const teacher = result?.ok ? result.value : null;

  return (
    <Screen
      loading={teacherQuery.isLoading}
      error={result && !result.ok ? result.error : null}
      onRetry={() => void teacherQuery.refetch()}
    >
      {teacher ? (
        <>
          <Text variant="title">{teacher.displayName}</Text>
          <Text variant="body" color="muted" style={{ marginTop: spacing.xs }}>
            {teacher.headline}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            {teacher.ratingCount > 0 ? (
              <Badge
                label={t('teachers.rating', {
                  rating: teacher.ratingAvg.toFixed(1),
                  count: teacher.ratingCount,
                })}
                glyph="★"
              />
            ) : (
              <Badge label={t('teachers.newTeacher')} glyph="✦" />
            )}
            <Badge label={t('teachers.lessonsTaught', { count: teacher.lessonsTaught })} />
          </View>

          <Card style={{ marginTop: spacing.lg }}>
            {teacher.badges.length > 0 ? (
              teacher.badges.map((badge) => (
                <View key={badge.code} style={{ marginBottom: spacing.md }}>
                  <Badge label={t(badge.labelKey)} tone="success" glyph="✓" />
                  <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
                    {t(badge.descriptionKey)}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="small" color="muted">
                {t('teachers.noBadges')}
              </Text>
            )}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text variant="caption" color="muted">
              {t('teachers.about')}
            </Text>
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              {teacher.bio}
            </Text>
          </Card>

          {teacher.specialties.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <Text variant="caption" color="muted">
                {t('teachers.specialties')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
                {teacher.specialties.map((specialty) => (
                  <Badge key={specialty} label={specialty.replace(/_/g, ' ')} />
                ))}
              </View>
            </Card>
          ) : null}

          {teacher.packages.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <Text variant="caption" color="muted">
                {t('teachers.packages')}
              </Text>
              {teacher.packages.map((pkg) => {
                const saving = packageSavingBps(
                  {
                    id: pkg.id,
                    lessonCount: pkg.lessonCount,
                    priceMinor: pkg.priceCents,
                    currency: pkg.currency as Currency,
                  },
                  teacher.hourlyRateCents,
                );
                return (
                  <View
                    key={pkg.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View>
                      <Text variant="body">{pkg.name}</Text>
                      <Text variant="caption" color="muted">
                        {t('teachers.lessonsTaught', { count: pkg.lessonCount })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="bodyStrong">
                        {formatMoney(pkg.priceCents, pkg.currency as Currency)}
                      </Text>
                      {saving > 0 ? (
                        <Text variant="caption" color="success">
                          {t('teachers.packageSave', { percent: Math.round(saving / 100) })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {teacher.reviews.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <Text variant="caption" color="muted">
                {t('teachers.reviews')}
              </Text>
              {teacher.reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={{ marginTop: spacing.md }}>
                  <Text variant="caption" color="muted">
                    {`${'★'.repeat(review.rating)} · ${review.learnerName}`}
                  </Text>
                  {review.body ? (
                    <Text variant="small" style={{ marginTop: 2 }}>
                      {review.body}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}

          <View style={{ marginTop: spacing.xxl }}>
            <Text variant="heading" align="center">
              {formatMoney(teacher.hourlyRateCents, teacher.currency as Currency)}
            </Text>
            <Text variant="caption" color="muted" align="center">
              {t('teachers.perLesson')}
            </Text>
            <Button
              label={t('teachers.bookLesson')}
              onPress={() => router.push(`/teacher/${teacher.userId}/book`)}
              fullWidth
              size="large"
              style={{ marginTop: spacing.md }}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
