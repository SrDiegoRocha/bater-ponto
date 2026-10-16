import { StyleSheet, View } from 'react-native';

import { useCountUp } from '@/hooks/use-count-up';
import { spacing, type ColorTokens } from '@/theme';

import { Card } from './card';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type StatDelta = { text: string; direction: 'up' | 'down' | 'flat' };

export type StatCardProps = {
  label: string;
  /** Texto fixo, ou… */
  value?: string;
  /** …número animado (count-up) com seu formatador */
  numeric?: number;
  format?: (n: number) => string;
  hint?: string;
  icon?: IconName;
  color?: keyof ColorTokens;
  /** Comparação com o período anterior */
  delta?: StatDelta;
  onPress?: () => void;
};

export function StatCard({ label, value, numeric, format, hint, icon, color = 'text', delta, onPress }: StatCardProps) {
  const card = (
    <Card style={styles.card}>
      <View style={styles.header}>
        {icon && <Icon name={icon} size={20} color={color === 'text' ? 'textMuted' : color} />}
        <Text variant="micro" color="textMuted" style={styles.label}>
          {label}
        </Text>
      </View>
      {numeric !== undefined && format ? (
        <AnimatedValue value={numeric} format={format} color={color} />
      ) : (
        <Text variant="title2" color={color} tabular numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      )}
      {delta ? (
        <View style={styles.delta}>
          <Icon
            name={delta.direction === 'up' ? 'arrow_upward' : delta.direction === 'down' ? 'arrow_downward' : 'remove'}
            size={20}
            color="textMuted"
          />
          <Text variant="caption" color="textMuted" tabular style={styles.label}>
            {delta.text}
          </Text>
        </View>
      ) : null}
      {hint ? (
        <Text variant="caption" color="textMuted">
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

function AnimatedValue({ value, format, color }: { value: number; format: (n: number) => string; color: keyof ColorTokens }) {
  const shown = useCountUp(value);
  return (
    <Text
      variant="title2"
      color={color}
      tabular
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={format(value)}
    >
      {format(shown)}
    </Text>
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  label: { flex: 1 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
