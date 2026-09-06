import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation } from '@/theme/tokens';
import { feedbackTap } from '@/services/feedback';

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
  const scale = useSharedValue(1);

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

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 10, mass: 1 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, mass: 1 });
  };

  const handlePress = () => {
    feedbackTap();
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={base}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
