import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PeriodSwipe } from '@/components/period/period-swipe';
import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Button, Card, ChoiceChips, Divider, Icon, PressableScale, SliderRow, SwitchRow, Text } from '@/components/ui';
import { Screen } from '@/components/ui/screen';
import { MoneyInput } from '@/components/ui/money-input';
import { cltConfigFromSettings, useCltBreakdown } from '@/hooks/use-clt-breakdown';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTimesheetCheck } from '@/hooks/use-timesheet-check';
import { useCountUp } from '@/hooks/use-count-up';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { computeCltPay, type CltBreakdown } from '@/domain/clt';
import { comparePayslip } from '@/domain/payslip';
import type { Period } from '@/domain/period';
import { simpleGrossCents, toCents } from '@/domain/salary';
import { TAX_YEAR } from '@/domain/tax-2026';
import { HOUR } from '@/domain/time';
import { getPayslip } from '@/db/payslip-repo';
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
      config: cltConfigFromSettings(settings, rate),
    });
  }, [clt, stats, period, workdays, dayOffs, holidays, now, extraSimulatedMs, rate, settings]);

  const total = breakdown ? breakdown.net : simpleGrossCents(worked, rate);

  return (
    <Screen title="Salário" keyboardShouldPersistTaps="handled">
      <PeriodSwipe>
        <View>
          <PeriodSwitcher period={period} />
        </View>
      </PeriodSwipe>

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

      <TimesheetCard period={period} />
      <PayslipCard period={period} />

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

/** Atalho para a conferência do espelho de ponto do período, com o andamento */
function TimesheetCard({ period }: { period: Period }) {
  const data = useTimesheetCheck(period);
  const summary = data?.summary;
  const started = !!summary && summary.checked > 0;
  const color = !started ? 'text' : summary.diffs > 0 ? 'danger' : 'work';
  const title = !started
    ? 'Conferir espelho de ponto'
    : summary.diffs > 0
      ? `Espelho: ${summary.diffs} ${summary.diffs === 1 ? 'dia diferente' : 'dias diferentes'}`
      : summary.pending === 0
        ? 'Espelho confere'
        : 'Espelho: nenhuma diferença até agora';
  const subtitle = !started
    ? 'Compare cada dia do espelho da empresa com o que você anotou.'
    : `${summary.checked} de ${summary.total} dias conferidos`;

  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push('/espelho')} accessibilityRole="button">
      <Card style={styles.payslip}>
        <Icon name="fact_check" color={color === 'text' ? 'primary' : color} />
        <View style={styles.rowLabel}>
          <Text variant="headline" color={color}>
            {title}
          </Text>
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        </View>
        <Icon name="chevron_right" color="textMuted" />
      </Card>
    </PressableScale>
  );
}

/** Atalho para a conferência do holerite do período, com o resultado se já foi feita */
function PayslipCard({ period }: { period: Period }) {
  const settings = useSettings();
  const breakdown = useCltBreakdown(period);
  const { data: payslip } = useDbQuery((d) => getPayslip(d, period), [period.start]);

  let title = 'Conferir holerite';
  let subtitle = 'Copie as horas extras, o adicional noturno e o DSR do holerite e veja se a empresa pagou certo.';
  let color: 'text' | 'work' | 'danger' = 'text';
  if (payslip && breakdown) {
    const values =
      settings.hourlyRate > 0 ? payslip : { ...payslip, extraCents: null, extraDoubleCents: null, nightCents: null, dsrCents: null };
    const check = comparePayslip(values, breakdown, settings);
    const underpaid = check.rows.some((r) => r.status === 'underpaid');
    title = underpaid
      ? check.missingCents > 0
        ? `Holerite: pode faltar ${formatMoney(check.missingCents)}`
        : 'Holerite: horas pagas a menos'
      : 'Holerite confere';
    subtitle = 'Toque para ver os detalhes ou corrigir os valores.';
    color = underpaid ? 'danger' : 'work';
  }

  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push('/holerite')} accessibilityRole="button">
      <Card style={styles.payslip}>
        <Icon name="receipt_long" color={color === 'text' ? 'primary' : color} />
        <View style={styles.rowLabel}>
          <Text variant="headline" color={color}>
            {title}
          </Text>
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        </View>
        <Icon name="chevron_right" color="textMuted" />
      </Card>
    </PressableScale>
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
  payslip: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
