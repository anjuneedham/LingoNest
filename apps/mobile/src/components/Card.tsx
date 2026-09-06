import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation } from '@/theme/tokens';

interface CardProps {
  readonly children: React.ReactNode;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly padded?: boolean;
  readonly raised?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

export function Card({
  children,
  onPress,
  style,
  padded = true,
  raised = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const { theme, spacing, radius } = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: padded ? spacing.lg : 0,
    ...(raised ? elevation.raised : elevation.card),
  };

  if (!onPress) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
