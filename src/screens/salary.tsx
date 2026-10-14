import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Card, Divider, Screen, Text } from '@/components/ui';
import { MoneyInput } from '@/components/ui/money-input';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { simpleGrossCents, toCents } from '@/domain/salary';
import { formatClock, formatDuration, formatMoney } from '@/lib/format';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

// Calculadora — modo simples (§3.6 / §5.6). Modo CLT e simulador chegam na fase 2.

export function Salary() {
  const db = useSQLiteContext();
  const period = useSelectedPeriod();
  const { stats } = usePeriodStats(period);
  const { hourlyRate } = useSettings();
  const update = useSettingsStore((s) => s.update);

  const worked = stats?.workedMs ?? 0;
  const gross = simpleGrossCents(worked, hourlyRate);

  return (
    <Screen title="Salário" keyboardShouldPersistTaps="handled">
      <PeriodSwitcher period={period} />

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Valor da sua hora
        </Text>
        <MoneyInput label="Valor da hora" value={hourlyRate} onCommit={(v) => update(db, { hourlyRate: v })} />
      </Card>

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Recibo estimado
        </Text>
        <Row label="Horas trabalhadas" value={`${formatClock(worked)} (${formatDuration(worked)})`} />
        <Row label="Valor da hora" value={hourlyRate > 0 ? formatMoney(toCents(hourlyRate)) : '—'} />
        <Divider />
        <View style={styles.total}>
          <Text variant="headline">Total bruto</Text>
          <Text variant="title1" color="money" tabular>
            {formatMoney(gross)}
          </Text>
        </View>
        {hourlyRate <= 0 ? (
          <Text variant="caption" color="textMuted">
            Informe o valor da sua hora acima para calcular.
          </Text>
        ) : null}
      </Card>

      <Text variant="caption" color="textMuted" align="center">
        Estimativa. Confira com seu holerite.{'\n'}Horas extras, adicional noturno e descontos chegam em breve.
      </Text>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      <Text variant="body" tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
