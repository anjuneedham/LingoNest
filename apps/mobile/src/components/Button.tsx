import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'small' | 'medium' | 'large';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: Variant;
  readonly size?: Size;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: React.ReactNode;
  readonly fullWidth?: boolean;
  readonly style?: ViewStyle;
  /** Overrides the label for screen readers when the label alone is ambiguous. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { theme, spacing, radius, type } = useTheme();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const scale = useSharedValue(1);

  const background: Record<Variant, string> = {
    primary: theme.primary,
    secondary: theme.surfaceMuted,
    ghost: 'transparent',
    danger: theme.danger,
    success: theme.success,
  };
  const textColor: Record<Variant, 'inverse' | 'default' | 'primary'> = {
    primary: 'inverse',
    secondary: 'default',
    ghost: 'primary',
    danger: 'inverse',
    success: 'inverse',
  };
  const heights: Record<Size, number> = { small: MIN_TOUCH_TARGET, medium: 52, large: 58 };

  const handlePress = () => {
    if (hapticsEnabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 10, mass: 1 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, mass: 1 });
  };

  const isInactive = disabled || loading;
  const animatedStyle = { transform: [{ scale }] };

  return (
    <Animated.View style={[animatedStyle, { alignSelf: fullWidth ? 'stretch' : 'flex-start' }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isInactive}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isInactive, busy: loading }}
        style={[
          styles.base,
          {
            minHeight: heights[size],
            paddingHorizontal: spacing.xl,
            borderRadius: radius.md,
            backgroundColor: background[variant],
            borderWidth: variant === 'ghost' || variant === 'secondary' ? 1 : 0,
            borderColor: variant === 'ghost' ? theme.border : theme.borderStrong,
            opacity: isInactive ? 0.5 : 1,
            width: fullWidth ? '100%' : 'auto',
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? theme.primary : theme.primaryText} />
        ) : (
          <View style={styles.content}>
            {icon ? <View style={{ marginRight: spacing.sm }}>{icon}</View> : null}
            <Text variant="bodyStrong" color={textColor[variant]} style={type('bodyStrong')}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center' },
});
