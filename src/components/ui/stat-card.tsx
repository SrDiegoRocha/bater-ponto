import { StyleSheet, View } from 'react-native';

import { spacing, type ColorTokens } from '@/theme';

import { Card } from './card';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  color?: keyof ColorTokens;
  onPress?: () => void;
};

export function StatCard({ label, value, hint, icon, color = 'text', onPress }: StatCardProps) {
  const card = (
    <Card style={styles.card}>
      <View style={styles.header}>
        {icon && <Icon name={icon} size={20} color={color === 'text' ? 'textMuted' : color} />}
        <Text variant="micro" color="textMuted" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </View>
      <Text variant="title2" color={color} tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
  if (!onPress) return <View style={styles.cell}>{card}</View>;
  return (
    <PressableScale style={styles.cell} scaleTo={0.97} onPress={onPress} accessibilityRole="button">
      {card}
    </PressableScale>
  );
}

/** Grade de 2 colunas para StatCards */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexBasis: '47%', flexGrow: 1 },
  card: { gap: spacing.xs, minHeight: 104 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { flex: 1 },
});
