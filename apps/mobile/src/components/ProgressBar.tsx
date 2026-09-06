import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

interface ProgressBarProps {
  /** 0..1 */
  readonly value: number;
  readonly label?: string;
  readonly showPercentage?: boolean;
  readonly height?: number;
  readonly color?: string;
  readonly style?: ViewStyle;
}

export function ProgressBar({
  value,
  label,
  showPercentage = false,
  height = 8,
  color,
  style,
}: ProgressBarProps) {
  const { theme, spacing, radius } = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  const percentage = Math.round(clamped * 100);
  const widthValue = useSharedValue(0);

  useEffect(() => {
    widthValue.value = withTiming(percentage, {
      duration: 400,
      easing: Easing.out(Easing.ease),
    });
  }, [percentage, widthValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthValue.value}%`,
  }));

  return (
    <View style={style}>
      {label || showPercentage ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          {label ? (
            <Text variant="caption" color="muted">
              {label}
            </Text>
          ) : null}
          {showPercentage ? (
            <Text variant="caption" color="muted">
              {percentage}%
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percentage }}
        accessibilityLabel={label}
        style={{
          height,
          borderRadius: radius.pill,
          backgroundColor: theme.surfaceMuted,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: color ?? theme.primary,
            },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}
