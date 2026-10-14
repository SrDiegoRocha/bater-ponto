import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { periodLabel, periodRangeLabel, type Period } from '@/domain/period';
import { useUiStore } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme } from '@/theme';

/** Navega entre períodos (compartilhado entre Histórico, Resumo e Salário) */
export function PeriodSwitcher({ period }: { period: Period }) {
  const { colors } = useTheme();
  const offset = useUiStore((s) => s.periodOffset);
  const setOffset = useUiStore((s) => s.setPeriodOffset);

  const go = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setOffset(offset + delta);
  };

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Período anterior" onPress={() => go(-1)} style={styles.arrow}>
        <Icon name="chevron_left" />
      </PressableScale>
      <PressableScale
        style={styles.center}
        scaleTo={0.98}
        disabled={offset === 0}
        onPress={() => go(-offset)}
        accessibilityRole="button"
        accessibilityHint={offset !== 0 ? 'Voltar ao período atual' : undefined}
      >
        <Text variant="headline" align="center">
          {periodLabel(period)}
        </Text>
        <Text variant="caption" color="textMuted" align="center">
          {periodRangeLabel(period)}
          {offset === 0 ? ' · atual' : ' · tocar para voltar ao atual'}
        </Text>
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Próximo período"
        disabled={offset >= 0}
        onPress={() => go(1)}
        style={[styles.arrow, { opacity: offset >= 0 ? 0.3 : 1 }]}
      >
        <Icon name="chevron_right" />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.xs },
  arrow: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, gap: 2, paddingVertical: spacing.xs },
});
