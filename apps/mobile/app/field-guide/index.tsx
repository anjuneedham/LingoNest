import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Card, Screen, Text } from '@/components';
import { CreatureIllustration } from '@/components/creatures';
import { useTheme } from '@/theme/ThemeProvider';
import { SPECIES } from '@/data/species';
import { useSpeciesUnlocks } from '@/hooks/useSpeciesUnlocks';

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  ja: 'Japanese',
};

/**
 * The Field Guide.
 *
 * Every language here belongs to a place, and every place has wildlife —
 * a species unlocks the moment a learner takes their first lesson in its
 * language, so the collection grows alongside actual progress rather than
 * being handed over all at once.
 */
export default function FieldGuide() {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const { unlocked } = useSpeciesUnlocks();

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <Text variant="title">{t('fieldGuide.title')}</Text>
      <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
        {t('fieldGuide.subtitle')}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        {SPECIES.map((species, i) =>
          unlocked[species.id] ? (
            <Animated.View key={species.id} entering={FadeInDown.delay(i * 60)}>
              <SpeciesCard speciesId={species.id} />
            </Animated.View>
          ) : (
            <LockedCard
              key={species.id}
              languageName={LANGUAGE_NAMES[species.languageCode ?? ''] ?? species.languageCode ?? ''}
            />
          ),
        )}
      </View>
    </Screen>
  );
}

function SpeciesCard({ speciesId }: { speciesId: (typeof SPECIES)[number]['id'] }) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const species = SPECIES.find((s) => s.id === speciesId)!;

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.lg,
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CreatureIllustration id={species.id} size={78} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Text variant="subheading">{species.commonName}</Text>
            <Text variant="caption" color="muted" style={{ fontStyle: 'italic' }}>
              {species.scientificName}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
            <Badge label={species.status} tone="success" />
            <Badge label={species.range} />
          </View>
        </View>
      </View>

      <Text variant="caption" color="muted" style={{ marginTop: spacing.lg, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {t('fieldGuide.naturalHistory')}
      </Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {species.naturalHistory.map((fact) => (
          <Text key={fact} variant="small" style={{ lineHeight: 20 }}>
            {`·  ${fact}`}
          </Text>
        ))}
      </View>

      <View
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: theme.warningMuted,
          borderLeftWidth: 3,
          borderLeftColor: theme.warning,
        }}
      >
        <Text variant="caption" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>
          {t('fieldGuide.legend')}
        </Text>
        <Text variant="small" style={{ marginTop: spacing.xs, lineHeight: 20 }}>
          {species.legend}
        </Text>
        <Text variant="caption" color="muted" style={{ marginTop: spacing.sm, fontStyle: 'italic' }}>
          {t('fieldGuide.legendCaveat')}
        </Text>
      </View>
    </Card>
  );
}

function LockedCard({ languageName }: { languageName: string }) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <Card style={{ marginBottom: spacing.lg, opacity: 0.6 }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.lg,
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="heading">🔒</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subheading" color="muted">
            {t('fieldGuide.locked')}
          </Text>
          <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
            {t('fieldGuide.lockedBody', { language: languageName })}
          </Text>
        </View>
      </View>
    </Card>
  );
}
