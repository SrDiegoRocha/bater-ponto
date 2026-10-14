import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Button, Card, ChoiceChips, Divider, SliderRow, SwitchRow, Text } from '@/components/ui';
import { Screen } from '@/components/ui/screen';
import { MoneyInput } from '@/components/ui/money-input';
import { useCountUp } from '@/hooks/use-count-up';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { computeCltPay, type CltBreakdown } from '@/domain/clt';
import { simpleGrossCents, toCents } from '@/domain/salary';
import { TAX_YEAR } from '@/domain/tax-2026';
import { HOUR } from '@/domain/time';
import { formatClock, formatDuration, formatMoney } from '@/lib/format';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

// Calculadora de salário (§3.6 / §5.6): modo simples e modo CLT, com simulador "E se?".

export function Salary() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const update = useSettingsStore((s) => s.update);
  const period = useSelectedPeriod();
  const { stats, workdays, dayOffs, holidays, now } = usePeriodStats(period);
  const [simulate, setSimulate] = useState(false);
  const [extraHours, setExtraHours] = useState(0);
  const [rateFactor, setRateFactor] = useState(1);

  const rate = settings.hourlyRate * (simulate ? rateFactor : 1);
  const extraSimulatedMs = simulate ? extraHours * HOUR : 0;
  const worked = (stats?.workedMs ?? 0) + extraSimulatedMs;
  const clt = settings.salaryMode === 'clt';

  const breakdown = useMemo<CltBreakdown | null>(() => {
    if (!clt || !stats) return null;
    return computeCltPay({
      period,
      workdays,
      dayOffs,
      holidays,
      now,
      extraSimulatedMs,
      config: {
        hourlyRate: rate,
        goal: settings.dailyGoal,
        overtimePct: settings.overtimePct,
        holidayOvertimePct: settings.holidayOvertimePct,
        nightPct: settings.nightPct,
        nightReduced: settings.nightReduced,
        dsrOnExtras: settings.dsrOnExtras,
        sundayDouble: settings.sundayDouble,
        dependents: settings.dependents,
      },
    });
  }, [clt, stats, period, workdays, dayOffs, holidays, now, extraSimulatedMs, rate, settings]);

  const total = breakdown ? breakdown.net : simpleGrossCents(worked, rate);

  return (
    <Screen title="Salário" keyboardShouldPersistTaps="handled">
      <PeriodSwitcher period={period} />

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Valor da sua hora
        </Text>
        <MoneyInput label="Valor da hora" value={settings.hourlyRate} onCommit={(v) => update(db, { hourlyRate: v })} />
        <ChoiceChips
          options={[
            { value: 'simple', label: 'Simples', icon: 'calculate' },
            { value: 'clt', label: 'CLT', icon: 'gavel' },
          ]}
          value={settings.salaryMode}
          onChange={(v) => update(db, { salaryMode: v })}
        />
        <Text variant="caption" color="textMuted">
          {clt
            ? 'Horas extras, feriados, adicional noturno, DSR e descontos de INSS e IRRF.'
            : 'Horas trabalhadas × valor da hora. Intervalos não contam.'}
        </Text>
      </Card>

      <Card style={styles.gap}>
        <View style={styles.totalHeader}>
          <Text variant="micro" color="textMuted">
            {breakdown ? 'Líquido estimado' : 'Total bruto'}
            {simulate ? ' · simulação' : ''}
          </Text>
        </View>
        <AnimatedMoney cents={total} />

        <Divider />
        {breakdown ? (
          <CltReceipt b={breakdown} rate={rate} />
        ) : (
          <>
            <Row label="Horas trabalhadas" value={`${formatClock(worked)} (${formatDuration(worked)})`} />
            <Row label="Valor da hora" value={rate > 0 ? formatMoney(toCents(rate)) : '—'} />
          </>
        )}
        {settings.hourlyRate <= 0 ? (
          <Text variant="caption" color="textMuted">
            Informe o valor da sua hora acima para calcular.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.gap}>
        <SwitchRow
          title="Simular “E se?”"
          subtitle="Veja o salário mudar com mais horas extras ou outro valor de hora"
          value={simulate}
          onValueChange={setSimulate}
        />
        {simulate ? (
          <>
            <SliderRow
              title="Horas extras a mais"
              valueLabel={`+${extraHours}h`}
              value={extraHours}
              onValueChange={(v) => setExtraHours(Math.round(v))}
              min={0}
              max={60}
              step={1}
            />
            <SliderRow
              title="Valor da hora"
              valueLabel={formatMoney(toCents(settings.hourlyRate * rateFactor))}
              value={rateFactor}
              onValueChange={(v) => setRateFactor(Math.round(v * 20) / 20)}
              min={0.5}
              max={2}
              step={0.05}
            />
          </>
        ) : null}
      </Card>

      {clt ? <Button label="Ajustar regras da CLT" icon="tune" variant="ghost" onPress={() => router.push('/ajustes/salario')} /> : null}
      <Text variant="caption" color="textMuted" align="center">
        Estimativa. Confira com seu holerite.{clt ? `\nDescontos pelas tabelas de INSS e IRRF de ${TAX_YEAR}.` : ''}
      </Text>
    </Screen>
  );
}

function AnimatedMoney({ cents }: { cents: number }) {
  const shown = useCountUp(cents);
  return (
    <Text variant="display" color="money" tabular adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={formatMoney(cents)}>
      {formatMoney(shown)}
    </Text>
  );
}

function CltReceipt({ b, rate }: { b: CltBreakdown; rate: number }) {
  return (
    <>
      <Row label={`Horas normais (${formatDuration(b.normalMs)})`} value={formatMoney(b.normalPay)} />
      {b.extraMs > 0 ? <Row label={`Extras comuns (${formatDuration(b.extraMs)})`} value={formatMoney(b.extraPay)} /> : null}
      {b.extraDoubleMs > 0 ? (
        <Row label={`Extras em feriado/folga (${formatDuration(b.extraDoubleMs)})`} value={formatMoney(b.extraDoublePay)} />
      ) : null}
      {b.nightBonusMs > 0 ? <Row label="Hora noturna reduzida" value={formatMoney(b.nightBonusPay)} /> : null}
      {b.nightAdditionalPay > 0 ? (
        <Row label={`Adicional noturno (${formatDuration(b.nightMs)})`} value={formatMoney(b.nightAdditionalPay)} />
      ) : null}
      {b.dsrPay > 0 ? (
        <Row label={`DSR sobre extras (${b.restDays}/${b.businessDays} dias)`} value={formatMoney(b.dsrPay)} />
      ) : null}
      <Divider />
      <Row label="Bruto" value={formatMoney(b.gross)} strong />
      <Row label="INSS" value={`−${formatMoney(b.inss)}`} />
      <Row label="IRRF" value={b.irrf > 0 ? `−${formatMoney(b.irrf)}` : 'isento'} />
      <Divider />
      <Row label="Líquido" value={formatMoney(b.net)} strong />
      <Text variant="caption" color="textMuted">
        Valor da hora usado: {formatMoney(toCents(rate))}
      </Text>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'headline' : 'body'} color={strong ? 'text' : 'textMuted'} style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant={strong ? 'headline' : 'body'} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { flex: 1 },
  totalHeader: { flexDirection: 'row', justifyContent: 'space-between' },
});
