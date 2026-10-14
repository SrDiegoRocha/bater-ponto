import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Card, Divider, ListRow, Screen, SectionHeader, StatCard, StatGrid } from '@/components/ui';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { simpleGrossCents } from '@/domain/salary';
import { formatDuration, formatMoney, formatShortDate } from '@/lib/format';
import { useSettings } from '@/stores/settings-store';
import { spacing } from '@/theme';

// Resumo do período (§4 / §5.5).

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutos desde 00:00 da data de referência → "08:30" ou "02:00 (+1)" */
function formatClockMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  const total = Math.round(minutes);
  const day = Math.floor(total / 1440);
  const m = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}${day > 0 ? ` (+${day})` : ''}`;
}

export function Summary() {
  const period = useSelectedPeriod();
  const { stats } = usePeriodStats(period);
  const { hourlyRate } = useSettings();

  return (
    <Screen title="Resumo">
      <PeriodSwitcher period={period} />
      {stats ? (
        <>
          <StatGrid>
            <StatCard label="Trabalhadas" value={formatDuration(stats.workedMs)} icon="work" color="work" />
            <StatCard label="Intervalos" value={formatDuration(stats.breakMs)} icon="pause" color="break" />
            <StatCard label="Dias trabalhados" value={String(stats.daysWorked)} icon="event_available" />
            <StatCard
              label="Folgas"
              value={String(stats.dayOffTotal)}
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
              value={formatDuration(stats.balanceMs, { signed: true })}
              icon="account_balance"
              color={stats.balanceMs < 0 ? 'danger' : 'work'}
              hint="saldo até hoje vs. meta diária"
            />
            <StatCard
              label="Salário estimado"
              value={hourlyRate > 0 ? formatMoney(simpleGrossCents(stats.workedMs, hourlyRate)) : 'Definir'}
              icon="payments"
              color="money"
              hint={hourlyRate > 0 ? 'bruto · toque para detalhes' : 'informe o valor da hora'}
              onPress={() => router.navigate('/salario')}
            />
          </StatGrid>

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
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
});
