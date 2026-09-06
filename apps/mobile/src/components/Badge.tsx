import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'streak';

interface BadgeProps {
  readonly label: string;
  readonly tone?: Tone;
  /**
   * An icon or glyph shown next to the label. Badges never rely on colour
   * alone: the icon and the text carry the meaning too (brief §62).
   */
  readonly glyph?: string;
  readonly style?: ViewStyle;
}

export function Badge({ label, tone = 'neutral', glyph, style }: BadgeProps) {
  const { theme, spacing, radius } = useTheme();

  const backgrounds: Record<Tone, string> = {
    neutral: theme.surfaceMuted,
    primary: theme.primaryMuted,
    success: theme.successMuted,
    danger: theme.dangerMuted,
    warning: theme.warningMuted,
    streak: theme.streakMuted,
  };
  const foregrounds: Record<Tone, 'default' | 'primary' | 'success' | 'danger'> = {
    neutral: 'default',
    primary: 'primary',
    success: 'success',
    danger: 'danger',
    warning: 'default',
    streak: 'default',
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.pill,
          backgroundColor: backgrounds[tone],
        },
        style,
      ]}
    >
      {glyph ? (
        <Text variant="caption" style={{ marginRight: 4 }}>
          {glyph}
        </Text>
      ) : null}
      <Text variant="caption" color={foregrounds[tone]}>
        {label}
      </Text>
    </View>
  );
}
