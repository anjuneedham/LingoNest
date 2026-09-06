import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { TypographyVariant } from '@/theme/tokens';

interface TextProps extends RNTextProps {
  readonly variant?: TypographyVariant;
  readonly color?: 'default' | 'muted' | 'primary' | 'success' | 'danger' | 'inverse';
  readonly align?: TextStyle['textAlign'];
  /**
   * Marks text in the language being learned, so it can be set larger, given
   * the right reading direction, and announced with the right language to a
   * screen reader.
   */
  readonly targetLanguage?: string;
}

export function Text({
  variant = 'body',
  color = 'default',
  align,
  targetLanguage,
  style,
  children,
  ...rest
}: TextProps) {
  const { theme, type } = useTheme();

  const colors = {
    default: theme.text,
    muted: theme.textMuted,
    primary: theme.primary,
    success: theme.success,
    danger: theme.danger,
    inverse: theme.textInverse,
  } as const;

  return (
    <RNText
      // A screen reader should pronounce Spanish as Spanish, not as English.
      accessibilityLanguage={targetLanguage}
      style={[type(variant), { color: colors[color], textAlign: align }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
