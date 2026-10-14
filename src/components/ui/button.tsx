import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { minTouch, radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  /** Ocupa toda a largura disponível */
  block?: boolean;
  haptic?: boolean;
};

const heights = { lg: 56, md: minTouch, sm: 36 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  block,
  haptic = true,
}: ButtonProps) {
  const { colors } = useTheme();

  const background = {
    primary: colors.primary,
    secondary: colors.surfaceRaised,
    ghost: 'transparent',
    destructive: 'transparent',
  }[variant];
  const foreground = (
    { primary: 'onPrimary', secondary: 'text', ghost: 'primary', destructive: 'danger' } as const
  )[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      android_ripple={{ color: colors.border, borderless: false, foreground: true }}
      // sm continua com alvo de 48dp graças ao hitSlop
      hitSlop={size === 'sm' ? 6 : undefined}
      style={[
        styles.base,
        { height: heights[size], backgroundColor: background, opacity: disabled ? 0.4 : 1 },
        variant === 'secondary' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        block && styles.block,
      ]}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} size={20} color={foreground} />}
        <Text variant={size === 'sm' ? 'caption' : 'headline'} color={foreground}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  block: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
