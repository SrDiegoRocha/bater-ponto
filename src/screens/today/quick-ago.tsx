import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { MINUTE } from '@/domain/time';
import { spacing } from '@/theme';

// "Voltei há 5 · 15 · 30 min": corrige o esquecimento mais comum sem abrir o editor.

const OPTIONS = [5, 15, 30];

export function QuickAgo({
  label,
  now,
  minAt,
  onPick,
  onMore,
}: {
  label: string;
  now: number;
  /** Horário mínimo aceito (última batida); opções antes disso ficam ocultas */
  minAt: number | null;
  /** Recebe os minutos escolhidos; o horário é calculado na hora do toque */
  onPick: (minutesAgo: number) => void;
  onMore: () => void;
}) {
  const options = OPTIONS.filter((m) => minAt === null || now - m * MINUTE > minAt);
  return (
    <View style={styles.row}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      {options.map((m) => (
        <Button key={m} label={`${m} min`} variant="secondary" size="sm" onPress={() => onPick(m)} />
      ))}
      <Button label="Outro" variant="ghost" size="sm" onPress={onMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
