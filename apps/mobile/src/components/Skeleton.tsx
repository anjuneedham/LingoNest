import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A content-shaped loading placeholder.
 *
 * Screens compose these into the rough outline of what's about to arrive
 * (a title bar, a couple of card blocks) instead of a spinner, so loading
 * reads as "this page, not yet filled in" rather than a blank interruption.
 */
interface SkeletonProps {
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly radius?: number;
  readonly style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0.5, { duration: 650 })), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.surfaceMuted },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** A skeleton shaped like a Card: an outlined block with a couple of lines inside. */
export function SkeletonCard({ lines = 2, style }: { readonly lines?: number; readonly style?: ViewStyle }) {
  const { theme, spacing, radius } = useTheme();
  return (
    <View
      style={[
        {
          padding: spacing.lg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        style,
      ]}
    >
      <Skeleton width="55%" height={13} />
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={16} />
        ))}
      </View>
    </View>
  );
}
