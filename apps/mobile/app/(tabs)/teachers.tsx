import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TEACHER_SPECIALTIES, formatMoney, type Currency } from '@lingonest/core';
import { Badge, Card, Screen, Skeleton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { searchTeachers, type TeacherCard, type TeacherFilters } from '@/services/marketplace';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * The teacher marketplace.
 *
 * Badges come from verification records via the shared `teacherBadges`, so a
 * badge here means the same thing it means on the profile and in the admin
 * list — and cannot be shown for a teacher who has not been verified (§84).
 */
export default function Teachers() {
  const { theme, spacing } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode);
  const [filters, setFilters] = useState<TeacherFilters>({});

  const searchQuery = useQuery({
    queryKey: ['teachers', languageCode, filters],
    queryFn: async () => {
      const result = await searchTeachers({ ...filters, languageCode: languageCode ?? undefined });
      if (result.ok) {
        track('teacher_search', {
          filters: Object.keys(filters),
          resultCount: result.value.length,
        });
      }
      return result;
    },
    enabled: Boolean(languageCode),
  });

  const result = searchQuery.data;
  const teachers = result?.ok ? result.value : [];

  const toggleSpecialty = (specialty: string) => {
    const current = filters.specialties ?? [];
    setFilters({
      ...filters,
      specialties: current.includes(specialty)
        ? current.filter((s) => s !== specialty)
        : [...current, specialty],
    });
  };

  return (
    <Screen
      loading={searchQuery.isLoading}
      skeleton={
        <>
          <Skeleton width="45%" height={22} />
          <Skeleton width="90%" height={32} style={{ marginTop: spacing.md, borderRadius: 999 }} />
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                marginTop: spacing.md,
                padding: spacing.lg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Skeleton width={56} height={56} radius={28} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Skeleton width="50%" height={16} />
                <Skeleton width="80%" height={12} style={{ marginTop: spacing.xs }} />
                <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
              </View>
            </View>
          ))}
        </>
      }
      error={result && !result.ok ? result.error : null}
      onRetry={() => void searchQuery.refetch()}
      empty={
        !searchQuery.isLoading && teachers.length === 0
          ? {
              title: t('teachers.noResults'),
              body: t('teachers.noResultsBody'),
              actionLabel: t('teachers.clearFilters'),
              onAction: () => setFilters({}),
              icon: (
                <Text variant="display" style={{ marginBottom: spacing.sm }}>
                  🔍
                </Text>
              ),
            }
          : null
      }
      onRefresh={() => void searchQuery.refetch()}
      refreshing={searchQuery.isRefetching}
    >
      <Text variant="title">{t('teachers.title')}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.md, marginHorizontal: -spacing.lg }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        <FilterChip
          label={t('teachers.filterNative')}
          active={Boolean(filters.nativeOnly)}
          onPress={() => setFilters({ ...filters, nativeOnly: !filters.nativeOnly })}
        />
        <FilterChip
          label={t('teachers.filterCertified')}
          active={Boolean(filters.certifiedOnly)}
          onPress={() => setFilters({ ...filters, certifiedOnly: !filters.certifiedOnly })}
        />
        {TEACHER_SPECIALTIES.slice(0, 8).map((specialty) => (
          <FilterChip
            key={specialty}
            label={specialty.replace(/_/g, ' ')}
            active={(filters.specialties ?? []).includes(specialty)}
            onPress={() => toggleSpecialty(specialty)}
          />
        ))}
      </ScrollView>

      {teachers.length > 0 ? (
        <Text variant="caption" color="muted" style={{ marginTop: spacing.md }}>
          {t('teachers.resultsCount', { count: teachers.length })}
        </Text>
      ) : null}

      {teachers.map((teacher, i) => (
        <Animated.View key={teacher.userId} entering={FadeInDown.delay(i * 60)}>
          <TeacherRow teacher={teacher} />
        </Animated.View>
      ))}
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginRight: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? theme.primary : theme.border,
        backgroundColor: active ? theme.primaryMuted : theme.surface,
      }}
    >
      <Text variant="caption" color={active ? 'primary' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

function TeacherRow({ teacher }: { teacher: TeacherCard }) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const isTopRated = teacher.ratingCount >= 10 && teacher.ratingAvg >= 4.5;

  return (
    <Card
      onPress={() => {
        track('teacher_view', { teacherId: teacher.userId, source: 'search' });
        router.push(`/teacher/${teacher.userId}`);
      }}
      raised={isTopRated}
      style={{
        marginTop: spacing.md,
        borderColor: isTopRated ? theme.primary : undefined,
        borderWidth: isTopRated ? 2 : 1,
      }}
      accessibilityLabel={`${teacher.displayName}, ${teacher.headline}`}
    >
      <View style={{ flexDirection: 'row' }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.pill,
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}
        >
          <Text variant="heading" color="muted">
            {teacher.displayName.slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="subheading">{teacher.displayName}</Text>
            <Text variant="bodyStrong" color="primary">
              {formatMoney(teacher.hourlyRateCents, teacher.currency as Currency)}
            </Text>
          </View>

          <Text variant="small" color="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {teacher.headline}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}>
            {teacher.ratingCount > 0 ? (
              <Text variant="caption" color="muted">
                {t('teachers.rating', {
                  rating: teacher.ratingAvg.toFixed(1),
                  count: teacher.ratingCount,
                })}
              </Text>
            ) : (
              <Badge label={t('teachers.newTeacher')} glyph="✦" />
            )}
            {isTopRated ? <Badge label={t('teachers.topRated')} tone="primary" glyph="⭐" /> : null}
            <Text variant="caption" color="muted">
              {t('teachers.lessonsTaught', { count: teacher.lessonsTaught })}
            </Text>
          </View>

          {/* Only shown when the verification records support them. */}
          {teacher.badges.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
              {teacher.badges.map((badge) => (
                <Badge key={badge.code} label={t(badge.labelKey)} tone="success" glyph="✓" />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
