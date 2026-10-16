import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { DailyHoursChart, WeeklyHoursChart, type DayBar, type WeekBar } from '@/components/charts/bar-chart';
import { dayOffColor } from '@/components/calendar/calendar-grid';
import { PeriodSwipe } from '@/components/period/period-swipe';
import { PeriodSwitcher } from '@/components/period/period-switcher';
import { computeCltPay } from '@/domain/clt';
import { buildSummaryText } from '@/lib/summary-text';
import { Card, Divider, EmptyState, Icon, ListRow, Screen, SectionHeader, StatCard, StatGrid, Text, type StatDelta } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { cltConfigFromSettings } from '@/hooks/use-clt-breakdown';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { periodDates, shiftPeriod, type Period } from '@/domain/period';
import { simpleGrossCents } from '@/domain/salary';
import type { PeriodStats } from '@/domain/stats';
import { addDaysToKey, MINUTE, toDateKey } from '@/domain/time';
import { weekStart } from '@/domain/work-rules';
import { formatDuration, formatMoney, formatShortDate } from '@/lib/format';
import { useSettings } from '@/stores/settings-store';
import { minTouch, spacing } from '@/theme';

// Resumo do período (§4 / §5.5): cards com count-up, comparação com o período anterior, gráficos e detalhes.

const pad = (n: number) => String(n).padStart(2, '0');

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
  if (diff === 0) return { text: 'igual', direction: 'flat' };
  return { text: format(Math.abs(diff)), direction: diff > 0 ? 'up' : 'down' };
}

export function Summary() {
  const settings = useSettings();
  const period = useSelectedPeriod();
  const previous = shiftPeriod(period, -1, settings.periodStartDay);
  const { stats, workdays, dayOffs, holidays, leadDays, now } = usePeriodStats(period);
  const { stats: prev } = usePeriodStats(previous);
  const { hourlyRate, workRules } = settings;
  const dailyLimitMs = workRules.dailyLimitMinutes * MINUTE;

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
        leadDays,
        now,
        config: cltConfigFromSettings(settings),
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
              delta={delta(stats.daysWorked, prev?.daysWorked, (n) => String(n))}
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
              label="Horas extras"
              numeric={stats.extraMs + stats.extraDoubleMs}
              format={formatDuration}
              icon="more_time"
              color="extra"
              delta={prev ? delta(stats.extraMs + stats.extraDoubleMs, prev.extraMs + prev.extraDoubleMs, formatDuration) : undefined}
              hint={
                stats.extraDoubleMs > 0
                  ? `${formatDuration(stats.extraDoubleMs)} a 100%`
                  : undefined
              }
            />
            <StatCard
              label="Salário"
              {...(hourlyRate > 0
                ? { numeric: money(stats.workedMs), format: formatMoney }
                : { value: 'Definir' })}
              icon="payments"
              color="money"
              delta={hourlyRate > 0 && prev ? delta(money(stats.workedMs), money(prev.workedMs), formatMoney) : undefined}
              hint={hourlyRate > 0 ? 'bruto estimado' : 'informe o valor da hora'}
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
              <DailyHoursChart days={dailyBars(stats, periodDates(period))} limitMs={dailyLimitMs} today={toDateKey(now)} />
            )}
          </Card>

          {stats.daysWorked > 0 ? (
            <>
              <SectionHeader title="Por semana" />
              <Card>
                <WeeklyHoursChart weeks={weeklyBars(stats, period)} limitMs={workRules.weeklyLimitMinutes * MINUTE} />
              </Card>
            </>
          ) : null}

          <SectionHeader title="Detalhes" />
          <Card style={styles.list}>
            <ListRow title="Média por dia trabalhado" icon="avg_pace" iconColor="work" value={formatDuration(stats.avgWorkedPerDayMs)} />
            <Divider inset={DIVIDER_INSET} />
            <ListRow title="Média de intervalo por dia" icon="coffee" iconColor="break" value={formatDuration(stats.avgBreakPerDayMs)} />
            <Divider inset={DIVIDER_INSET} />
            <ListRow
              title="Maior jornada"
              icon="trending_up"
              subtitle={stats.longest ? formatShortDate(stats.longest.date) : undefined}
              value={stats.longest ? formatDuration(stats.longest.ms) : '—'}
            />
            <Divider inset={DIVIDER_INSET} />
            <ListRow
              title="Menor jornada"
              icon="trending_down"
              subtitle={stats.shortest ? formatShortDate(stats.shortest.date) : undefined}
              value={stats.shortest ? formatDuration(stats.shortest.ms) : '—'}
            />
            <Divider inset={DIVIDER_INSET} />
            <ListRow title="Início médio do dia" icon="login" value={formatClockMinutes(stats.avgStartMinutes)} />
            <Divider inset={DIVIDER_INSET} />
            <ListRow title="Fim médio do dia" icon="logout" value={formatClockMinutes(stats.avgEndMinutes)} />
            <Divider inset={DIVIDER_INSET} />
            <ListRow title="Horas noturnas (22h–5h)" icon="dark_mode" iconColor="night" value={formatDuration(stats.nightMs)} />
            <Divider inset={DIVIDER_INSET} />
            <ListRow
              title="Menor interjornada"
              icon="bedtime"
              iconColor={stats.shortRestCount > 0 ? 'break' : 'textMuted'}
              subtitle={stats.shortRestCount > 0 ? `${stats.shortRestCount} abaixo de 11h` : 'mínimo da CLT: 11h'}
              value={stats.minRestMs !== null ? formatDuration(stats.minRestMs) : '—'}
            />
            <Divider inset={DIVIDER_INSET} />
            <ListRow
              title="Feriados"
              icon="celebration"
              iconColor="holiday"
              subtitle={`${stats.holidaysWorked} trabalhados · ${stats.holidaysOff} de folga`}
              value={String(stats.holidaysWorked + stats.holidaysOff)}
            />
            <Divider inset={DIVIDER_INSET} />
            <ListRow title="Dias sem registro" icon="event_busy" value={String(stats.daysWithoutRecord)} />
            {stats.incompleteCount > 0 ? (
              <>
                <Divider inset={DIVIDER_INSET} />
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
            As setas comparam com o período anterior ({formatShortDate(previous.start)} a {formatShortDate(previous.end)}).
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

function dailyBars(stats: PeriodStats, dates: string[]): DayBar[] {
  return dates.map((date) => {
    const status = stats.days.get(date);
    const o = stats.overtime.get(date);
    const marker =
      status?.type === 'dayOff' ? dayOffColor[status.kind] : status?.type === 'holiday' ? ('holiday' as const) : undefined;
    return {
      date,
      normalMs: o?.normalMs ?? 0,
      extraMs: o ? o.extraMs + o.extraDoubleMs : 0,
      marker,
      incomplete: status?.type === 'worked' && status.incomplete,
    };
  });
}

/** Semanas (seg–dom) que tocam o período; as das pontas podem estar cortadas */
function weeklyBars(stats: PeriodStats, period: Period): WeekBar[] {
  const weeks = new Map<string, WeekBar>();
  for (const date of periodDates(period)) {
    const start = weekStart(date);
    const end = addDaysToKey(start, 6);
    const week = weeks.get(start) ?? { start, end, workedMs: 0, extraMs: 0, partial: start < period.start || end > period.end };
    const o = stats.overtime.get(date);
    if (o) {
      week.workedMs += o.normalMs + o.extraMs + o.extraDoubleMs;
      week.extraMs += o.extraMs + o.extraDoubleMs;
    }
    weeks.set(start, week);
  }
  return [...weeks.values()];
}

const DIVIDER_INSET = 48;

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row' },
});
