import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cefrDisplay, type Cefr } from '@lingonest/core';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

interface LevelPillProps {
  readonly level: Cefr | null;
  /** Shows "estimated" alongside the level, which is what it always is. */
  readonly showEstimatedLabel?: boolean;
  readonly size?: 'small' | 'medium';
}

/**
 * Renders a CEFR level.
 *
 * Every level shown to a learner goes through here, and it always frames the
 * level as an estimate. There is no code path that presents a level as a
 * certification (brief §2).
 */
export function LevelPill({ level, showEstimatedLabel = false, size = 'medium' }: LevelPillProps) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();

  if (!level) {
    return (
      <Text variant="caption" color="muted">
        {t('cefr.notYetEstimated')}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          paddingHorizontal: size === 'small' ? spacing.sm : spacing.md,
          paddingVertical: size === 'small' ? 2 : spacing.xs,
          borderRadius: radius.sm,
          backgroundColor: theme.primaryMuted,
        }}
      >
        <Text variant={size === 'small' ? 'caption' : 'bodyStrong'} color="primary">
          {cefrDisplay(level)}
        </Text>
      </View>
      {showEstimatedLabel ? (
        <Text variant="caption" color="muted" style={{ marginLeft: spacing.sm }}>
          {t('cefr.estimated')}
        </Text>
      ) : null}
    </View>
  );
}
