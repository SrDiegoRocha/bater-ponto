import { StyleSheet, View } from 'react-native';

import { minTouch, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="micro" color="textMuted" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: keyof ColorTokens;
  /** Valor à direita (ex.: "8h", "R$ 25,00") */
  value?: string;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, icon, iconColor = 'textMuted', value, onPress }: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {icon && <Icon name={icon} color={iconColor} />}
      <View style={styles.rowText}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="textMuted" tabular>
          {value}
        </Text>
      ) : null}
      {onPress && <Icon name="chevron_right" size={20} color="textMuted" />}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: colors.border }}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  row: {
    minHeight: minTouch + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
});
