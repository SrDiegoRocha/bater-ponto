import { StyleSheet, View } from 'react-native';

import { Button, Card, ProgressRing, Screen, StatusPill, Text } from '@/components/ui';
import { getPeriodContaining, periodDates, periodLabel, periodRangeLabel } from '@/domain/period';
import { toDateKey } from '@/domain/time';
import { formatLongDay } from '@/lib/format';
import { useSettings } from '@/stores/settings-store';
import { spacing } from '@/theme';

// Fase 0: esqueleto visual da tela Hoje (§5.2). A máquina de estados e as batidas entram na fase 1.

export function Today() {
  const { periodStartDay } = useSettings();
  const today = toDateKey(new Date());
  const period = getPeriodContaining(today, periodStartDay);
  const daysLeft = periodDates(period).filter((d) => d >= today).length;

  return (
    <Screen
      title={formatLongDay(today)}
      subtitle={`${periodLabel(period)} · ${periodRangeLabel(period)} · faltam ${daysLeft} dias`}
    >
      <View style={styles.hero}>
        <ProgressRing progress={0} size={260}>
          <View style={styles.ringContent}>
            <Text variant="display" tabular>
              00:00
            </Text>
            <StatusPill status="off" />
          </View>
        </ProgressRing>
      </View>

      <Button label="Iniciar dia" icon="play_arrow" size="lg" block disabled onPress={() => {}} />
      <Text variant="caption" color="textMuted" align="center">
        Bater o ponto chega na fase 1.
      </Text>

      <Card>
        <Text variant="micro" color="textMuted">
          Período
        </Text>
        <Text variant="title2" tabular>
          0h trabalhadas
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  ringContent: { alignItems: 'center', gap: spacing.sm },
});
