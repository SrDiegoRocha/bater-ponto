import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { BarChart, type Bar } from '@/components/charts/bar-chart';
import { PeriodSwipe } from '@/components/period/period-swipe';
import { PeriodSwitcher } from '@/components/period/period-switcher';
import { computeCltPay } from '@/domain/clt';
import { buildSummaryText } from '@/lib/summary-text';
import { Card, Divider, EmptyState, Icon, ListRow, Screen, SectionHeader, StatCard, StatGrid, Text, type StatDelta } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { goalForDate } from '@/domain/balance';
import { periodDates, shiftPeriod } from '@/domain/period';
import { simpleGrossCents } from '@/domain/salary';
import type { PeriodStats } from '@/domain/stats';
import { fromDateKey, HOUR } from '@/domain/time';
import { formatDuration, formatMoney, formatShortDate } from '@/lib/format';
import { useSettings } from '@/stores/settings-store';
import { minTouch, spacing } from '@/theme';

// Resumo do período (§4 / §5.5): cards com count-up, comparação com o período anterior, gráficos e detalhes.

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Minutos desde 00:00 da data de referência → "08:30" ou "02:00 (+1)" */
function formatClockMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  const total = Math.round(minutes);
  const day = Math.floor(total / 1440);
  const m = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}${day > 0 ? ` (+${day})` : ''}`;
}

function delta(current: number, previous: number | undefined, format: (n: number) => string): StatDelta | undefined {
  if (previous === undefined) return undefined;
  const diff = current - previous;
  if (diff === 0) return { text: 'igual ao anterior', direction: 'flat' };
  return { text: `${format(Math.abs(diff))} vs anterior`, direction: diff > 0 ? 'up' : 'down' };
}

const hoursLabel = (v: number) => formatDuration(v * HOUR);

export function Summary() {
  const settings = useSettings();
  const period = useSelectedPeriod();
  const previous = shiftPeriod(period, -1, settings.periodStartDay);
  const { stats, workdays, dayOffs, holidays, now } = usePeriodStats(period);
  const { stats: prev } = usePeriodStats(previous);
  const { hourlyRate, dailyGoal } = settings;

  const money = (ms: number) => simpleGrossCents(ms, hourlyRate);

  function share() {
    if (!stats) return;
    let salary: { label: string; cents: number } | null = null;
    if (hourlyRate > 0 && settings.salaryMode === 'clt') {
      const b = computeCltPay({
        period,
        workdays,
        dayOffs,
        holidays,
        now,
        config: { ...settings, goal: settings.dailyGoal },
      });
      salary = { label: 'Salário líquido estimado', cents: b.net };
    } else if (hourlyRate > 0) {
      salary = { label: 'Salário bruto estimado', cents: money(stats.workedMs) };
    }
    Share.share({ message: buildSummaryText(period, stats, salary) }).catch(() => {});
  }

  return (
    <Screen
      title="Resumo"
      headerRight={
        <View style={styles.headerActions}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Compartilhar resumo" onPress={share} style={styles.iconButton}>
            <Icon name="share" color="textMuted" />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Exportar PDF"
            onPress={() => router.push('/exportar')}
            style={styles.iconButton}
          >
            <Icon name="picture_as_pdf" color="textMuted" />
          </PressableScale>
        </View>
      }
    >
      <PeriodSwitcher period={period} />
      {stats ? (
        <>
          <PeriodSwipe>
          <View>
          <StatGrid>
            <StatCard
              label="Trabalhadas"
              numeric={stats.workedMs}
              format={formatDuration}
              icon="work"
              color="work"
              delta={delta(stats.workedMs, prev?.workedMs, formatDuration)}
            />
            <StatCard
              label="Intervalos"
              numeric={stats.breakMs}
              format={formatDuration}
              icon="pause"
              color="break"
              delta={delta(stats.breakMs, prev?.breakMs, formatDuration)}
            />
            <StatCard
              label="Dias trabalhados"
              numeric={stats.daysWorked}
              format={(n) => String(Math.round(n))}
              icon="event_available"
              delta={delta(stats.daysWorked, prev?.daysWorked, (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`)}
            />
            <StatCard
              label="Folgas"
              numeric={stats.dayOffTotal}
              format={(n) => String(Math.round(n))}
              icon="beach_access"
              color="dayOff"
              hint={
                [
                  stats.dayOffs.ferias && `${stats.dayOffs.ferias} férias`,
                  stats.dayOffs.atestado && `${stats.dayOffs.atestado} atestado`,
                  stats.holidaysOff && `${stats.holidaysOff} feriado`,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
            />
            <StatCard
              label="Banco de horas"
              numeric={stats.balanceMs}
              format={(n) => formatDuration(n, { signed: true })}
              icon="account_balance"
              color={stats.balanceMs < 0 ? 'danger' : 'work'}
              hint="saldo até hoje vs. meta diária"
            />
            <StatCard
              label="Salário estimado"
              {...(hourlyRate > 0
                ? { numeric: money(stats.workedMs), format: formatMoney }
                : { value: 'Definir' })}
              icon="payments"
              color="money"
              delta={hourlyRate > 0 && prev ? delta(money(stats.workedMs), money(prev.workedMs), formatMoney) : undefined}
              hint={hourlyRate > 0 ? (settings.salaryMode === 'clt' ? 'horas × valor · CLT na aba Salário' : 'bruto · toque para detalhes') : 'informe o valor da hora'}
              onPress={() => router.navigate('/salario')}
            />
          </StatGrid>
          </View>
          </PeriodSwipe>

          <SectionHeader title="Horas por dia" />
          <Card>
            {stats.daysWorked === 0 ? (
              <EmptyState illustration="period" title="Sem horas neste período" />
            ) : (
              <BarChart
                bars={dailyBars(stats, periodDates(period))}
                reference={{ value: dailyGoal.defaultMinutes / 60, label: `meta ${formatDuration(goalForDate(period.start, dailyGoal))}` }}
                formatValue={hoursLabel}
                labelEvery={5}
                accessibilityLabel={`Horas trabalhadas por dia no período. Total ${formatDuration(stats.workedMs)}.`}
              />
            )}
          </Card>

          {stats.daysWorked > 0 ? (
            <>
              <SectionHeader title="Por dia da semana" />
              <Card>
                <BarChart
                  bars={weekdayBars(stats)}
                  formatValue={hoursLabel}
                  height={120}
                  accessibilityLabel="Total de horas trabalhadas por dia da semana"
                />
              </Card>
            </>
          ) : null}

          <SectionHeader title="Detalhes" />
          <Card style={styles.list}>
            <ListRow title="Média por dia trabalhado" value={formatDuration(stats.avgWorkedPerDayMs)} />
            <Divider />
            <ListRow title="Média de intervalo por dia" value={formatDuration(stats.avgBreakPerDayMs)} />
            <Divider />
            <ListRow
              title="Maior jornada"
              subtitle={stats.longest ? formatShortDate(stats.longest.date) : undefined}
              value={stats.longest ? formatDuration(stats.longest.ms) : '—'}
            />
            <Divider />
            <ListRow
              title="Menor jornada"
              subtitle={stats.shortest ? formatShortDate(stats.shortest.date) : undefined}
              value={stats.shortest ? formatDuration(stats.shortest.ms) : '—'}
            />
            <Divider />
            <ListRow title="Início médio do dia" value={formatClockMinutes(stats.avgStartMinutes)} />
            <Divider />
            <ListRow title="Fim médio do dia" value={formatClockMinutes(stats.avgEndMinutes)} />
            <Divider />
            <ListRow title="Horas noturnas (22h–5h)" icon="dark_mode" iconColor="night" value={formatDuration(stats.nightMs)} />
            <Divider />
            <ListRow
              title="Menor interjornada"
              subtitle={stats.shortRestCount > 0 ? `${stats.shortRestCount} abaixo de 11h` : undefined}
              value={stats.minRestMs !== null ? formatDuration(stats.minRestMs) : '—'}
            />
            <Divider />
            <ListRow
              title="Feriados"
              icon="celebration"
              iconColor="holiday"
              value={`${stats.holidaysWorked} trabalhados · ${stats.holidaysOff} de folga`}
            />
            <Divider />
            <ListRow title="Dias sem registro" value={String(stats.daysWithoutRecord)} />
            {stats.incompleteCount > 0 ? (
              <>
                <Divider />
                <ListRow
                  title="Jornadas incompletas"
                  subtitle="fora dos totais até serem corrigidas"
                  icon="error"
                  iconColor="danger"
                  value={String(stats.incompleteCount)}
                  onPress={() => router.navigate('/historico')}
                />
              </>
            ) : null}
          </Card>
          <Text variant="caption" color="textMuted" align="center">
            Comparações usam o período anterior ({formatShortDate(previous.start)} a {formatShortDate(previous.end)}).
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

function dailyBars(stats: PeriodStats, dates: string[]): Bar[] {
  return dates.map((date) => {
    const status = stats.days.get(date);
    const worked = status?.type === 'worked' ? status.workedMs : 0;
    return {
      key: date,
      label: String(Number(date.slice(8))),
      value: worked / HOUR,
      detail: formatShortDate(date),
    };
  });
}

function weekdayBars(stats: PeriodStats): Bar[] {
  const totals = Array<number>(7).fill(0);
  for (const [date, status] of stats.days) {
    if (status.type === 'worked') totals[fromDateKey(date).getDay()] += status.workedMs;
  }
  // Semana começando na segunda
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: String(d), label: WEEKDAYS[d], value: totals[d] / HOUR }));
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row' },
});
