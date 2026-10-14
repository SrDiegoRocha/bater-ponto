import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type BannerProps = {
  tone?: 'info' | 'warning' | 'danger';
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onPress?: () => void;
};

const toneColor: Record<NonNullable<BannerProps['tone']>, keyof ColorTokens> = {
  info: 'primary',
  warning: 'break',
  danger: 'danger',
};

export function Banner({ tone = 'info', icon = 'info', title, description, actionLabel, onPress }: BannerProps) {
  const { colors } = useTheme();
  const color = toneColor[tone];
  const body = (
    <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors[color] }]}>
      <Icon name={icon} color={color} />
      <View style={styles.text}>
        <Text variant="headline">{title}</Text>
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      {actionLabel ? (
        <Text variant="headline" color={color}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale scaleTo={0.98} onPress={onPress} accessibilityRole="button">
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
  },
  text: { flex: 1, gap: 2 },
});
