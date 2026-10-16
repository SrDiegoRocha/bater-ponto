import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Icon, Screen, StatusPill, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { dayOffLabel } from '@/components/calendar/calendar-grid';
import { Timeline } from '@/components/workday/timeline';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useCurrentPeriod, usePeriodStats } from '@/hooks/use-period-stats';
import { periodDates, periodLabel, periodRangeLabel } from '@/domain/period';
import { simpleGrossCents } from '@/domain/salary';
import { deriveDayState, type DayState } from '@/domain/state-machine';
import { HOUR, MINUTE, toDateKey } from '@/domain/time';
import { MIN_REST_MS } from '@/domain/validation';
import { weekWorkedMs } from '@/domain/work-rules';
import { summarizeWorkday } from '@/domain/workday';
import { countIncompleteWorkdays, getOpenWorkday, listRecentWorkdays } from '@/db/workday-repo';
import { formatDayRange, formatDuration, formatLongDay, formatMoney, formatShortDate, formatTime } from '@/lib/format';
import { clearDayOffs } from '@/services/punch-service';
import { updateQuickActions } from '@/services/quick-actions';
import { useSettings } from '@/stores/settings-store';
import { minTouch, radius, spacing, useTheme, type ColorTokens } from '@/theme';

import { TodayHero } from './live-clock';

// O ponto oficial é batido no app da empresa; aqui o usuário só anota o horário que ele mostrou
// para conferir as horas e o salário.

const entryLabel: Record<DayState, string> = {
  off: 'Anotar entrada',
  working: 'Anotar saída',
  break: 'Anotar volta do intervalo',
};

const OPEN_ALERT_MS = 16 * HOUR;

export function Today() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const now = useNow();
  const today = toDateKey(now);
  const period = useCurrentPeriod();
  const { stats, leadDays } = usePeriodStats(period);

  const { data } = useDbQuery(
    async (d) => ({
      open: await getOpenWorkday(d),
      recent: await listRecentWorkdays(d, 2),
      incomplete: await countIncompleteWorkdays(d),
      firstIncomplete: await d.getFirstAsync<{ id: string }>(
        "SELECT id FROM workday WHERE status = 'incomplete' ORDER BY ref_date DESC LIMIT 1",
      ),
    }),
    [],
  );

  const open = data?.open ?? null;
  const state = deriveDayState(open?.punches ?? null);

  // Jornada mostrada: a aberta, ou a última se ela começou ou terminou hoje
  const lastClosed = data?.recent.find((w) => w.status === 'closed') ?? null;
  const lastEnd = lastClosed?.punches.at(-1)?.at ?? null;
  const shown =
    open ??
    (lastClosed && (lastClosed.refDate === today || (lastEnd !== null && toDateKey(lastEnd) === today)) ? lastClosed : null);
  const summary = shown ? summarizeWorkday(shown.punches, now) : null;

  const dayStatus = stats?.days.get(today);
  const todayDayOff = dayStatus?.type === 'dayOff' ? dayStatus.kind : null;
  const holiday = dayStatus && 'holiday' in dayStatus ? dayStatus.holiday : null;
  const limitMs = settings.workRules.dailyLimitMinutes * MINUTE;

  const restMs = state === 'off' && lastEnd !== null ? now - lastEnd : null;
  const openForMs = open?.punches[0] ? now - open.punches[0].at : 0;
  const daysLeft = periodDates(period).filter((d) => d >= today).length;

  // Nada anotado hoje: quem copia tudo no fim do dia prefere cadastrar a jornada inteira de uma vez
  const nothingToday = state === 'off' && !shown;

  // Atalhos do ícone acompanham o estado do dia
  useEffect(() => {
    if (data) updateQuickActions(state);
  }, [data, state]);

  async function workAnyway() {
    await clearDayOffs(db, [today]);
    router.push('/bater');
  }

  return (
    <Screen
      title={formatLongDay(today)}
      subtitle={`${periodLabel(period)} · ${periodRangeLabel(period)} · ${daysLeft === 1 ? 'último dia' : `faltam ${daysLeft} dias`}`}
      headerRight={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          onPress={() => router.push('/ajustes')}
          style={styles.iconButton}
        >
          <Icon name="settings" color="textMuted" />
        </PressableScale>
      }
    >
      {data && data.incomplete > 0 && data.firstIncomplete ? (
        <Banner
          tone="danger"
          icon="error"
          title={data.incomplete === 1 ? '1 jornada incompleta' : `${data.incomplete} jornadas incompletas`}
          description="Falta alguma batida. Corrija para entrar nos totais."
          actionLabel="Corrigir"
          onPress={() => router.push(`/jornada/${data.firstIncomplete!.id}`)}
        />
      ) : null}

      {open && openForMs > OPEN_ALERT_MS ? (
        <Banner
          tone="warning"
          icon="schedule"
          title={`Jornada aberta há ${formatDuration(openForMs)}`}
          description="Faltou anotar a saída?"
          actionLabel="Revisar"
          onPress={() => router.push(`/jornada/${open.id}`)}
        />
      ) : null}

      {holiday ? <StatusPill status="holiday" label={`Feriado · ${holiday.name}`} /> : null}

      {todayDayOff && state === 'off' ? (
        <Card style={styles.dayOffCard}>
          <Icon name="beach_access" size={32} color="dayOff" />
          <Text variant="title2" align="center">
            Hoje é {dayOffLabel[todayDayOff].toLowerCase()}
          </Text>
          <Text variant="body" color="textMuted" align="center">
            Se precisou trabalhar, anote normalmente: as horas contam como extra 100%.
          </Text>
          <Button label="Trabalhei mesmo assim" icon="edit" variant="secondary" onPress={workAnyway} />
        </Card>
      ) : (
        <>
          <TodayHero
            punches={shown?.punches ?? null}
            state={state}
            limitMs={limitMs}
            premiumDay={!!holiday || !!todayDayOff}
            compensation={settings.workRules.compensation}
          />

          <View style={styles.actions}>
            <Button label={entryLabel[state]} icon="edit" size="lg" block onPress={() => router.push('/bater')} />
            {nothingToday ? (
              <View style={styles.secondaryRow}>
                <View style={styles.flex}>
                  <Button
                    label="Dia inteiro"
                    icon="view_timeline"
                    variant="secondary"
                    block
                    onPress={() => router.push({ pathname: '/jornada/nova', params: { date: today } })}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Folga hoje"
                    icon="beach_access"
                    variant="secondary"
                    block
                    onPress={() => router.push({ pathname: '/folga', params: { dates: today } })}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </>
      )}

      {state === 'off' && lastClosed && lastEnd !== null && shown !== lastClosed ? (
        <Card style={styles.lastCard}>
          <Text variant="micro" color="textMuted">
            Última jornada
          </Text>
          <View style={styles.lastRow}>
            <Text variant="headline" style={styles.flex}>
              {formatShortDate(lastClosed.refDate)}
            </Text>
            <Text variant="body" color="textMuted" tabular>
              {formatTime(lastClosed.punches[0].at)} → {formatTime(lastEnd)}
            </Text>
            <Text variant="headline" tabular>
              {formatDuration(summarizeWorkday(lastClosed.punches, now).workedMs)}
            </Text>
          </View>
          {restMs !== null ? (
            <View style={styles.lastRow}>
              <Icon name="bedtime" size={20} color={restMs < MIN_REST_MS ? 'break' : 'textMuted'} />
              <Text variant="caption" color={restMs < MIN_REST_MS ? 'break' : 'textMuted'} tabular style={styles.flex}>
                Descansando há {formatDuration(restMs)}
                {restMs < MIN_REST_MS ? ` · a CLT pede 11h entre jornadas (liberado às ${formatTime(lastEnd + MIN_REST_MS)})` : ''}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {shown && shown.punches.length > 0 ? (
        <Card style={styles.timelineCard}>
          <View style={styles.cardHeader}>
            <Text variant="micro" color="textMuted">
              Batidas de hoje
            </Text>
            <Button label="Ver jornada" variant="ghost" size="sm" onPress={() => router.push(`/jornada/${shown.id}`)} />
          </View>
          <Timeline punches={shown.punches} now={now} editable live={shown.status === 'open'} />
          {summary ? (
            <View style={styles.totals}>
              <Total label="Trabalhado" value={formatDuration(summary.workedMs)} color="work" />
              <Total label="Intervalo" value={formatDuration(summary.breakMs)} color="break" />
              <Total label="Turnos" value={String(summary.segments.length)} color="text" />
            </View>
          ) : null}
          <Text variant="caption" color="textMuted" align="center">
            Toque numa batida para ajustar · segure para excluir
          </Text>
        </Card>
      ) : null}

      {stats ? <WeekCard week={weekWorkedMs(today, stats.overtime, leadDays)} limitMs={settings.workRules.weeklyLimitMinutes * MINUTE} /> : null}

      {stats ? (
        <PressableScale scaleTo={0.98} onPress={() => router.navigate('/resumo')} accessibilityRole="button" accessibilityHint="Abre o resumo do período">
          <Card style={styles.periodCard}>
            <View style={styles.cardHeader}>
              <Text variant="micro" color="textMuted">
                Período · {periodRangeLabel(period)}
              </Text>
              <Icon name="chevron_right" size={20} color="textMuted" />
            </View>
            <View style={styles.totals}>
              <Total label="Trabalhadas" value={formatDuration(stats.workedMs)} color="work" />
              <Total label="Extras" value={formatDuration(stats.extraMs + stats.extraDoubleMs)} color="extra" />
              <Total label="Dias" value={String(stats.daysWorked)} color="text" />
            </View>
            {settings.hourlyRate > 0 ? (
              <Text variant="caption" color="textMuted" tabular>
                Estimativa bruta até agora: <Text variant="caption" color="money">{formatMoney(simpleGrossCents(stats.workedMs, settings.hourlyRate))}</Text>
              </Text>
            ) : null}
          </Card>
        </PressableScale>
      ) : null}
    </Screen>
  );
}

/** Banco da semana: horas de seg a dom que contam para o limite semanal (44h pela CLT) */
function WeekCard({ week, limitMs }: { week: ReturnType<typeof weekWorkedMs>; limitMs: number }) {
  const { colors } = useTheme();
  const over = week.workedMs - limitMs;
  const pct = limitMs > 0 ? Math.min(1, week.workedMs / limitMs) : 0;
  return (
    <Card style={styles.weekCard}>
      <View style={styles.cardHeader}>
        <Text variant="micro" color="textMuted">
          Esta semana · {formatDayRange(week.start, week.end)}
        </Text>
      </View>
      <Text variant="headline" tabular>
        {formatDuration(week.workedMs)} <Text variant="body" color="textMuted">de {formatDuration(limitMs)}</Text>
      </Text>
      <View style={[styles.weekTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.weekFill, { width: `${pct * 100}%`, backgroundColor: over > 0 ? colors.extra : colors.work }]} />
      </View>
      <Text variant="caption" color={over >= MINUTE ? 'extra' : 'textMuted'} tabular>
        {over >= MINUTE
          ? `${formatDuration(over)} acima do limite da semana: tende a ser hora extra`
          : `Faltam ${formatDuration(-over)} para chegar ao limite da semana`}
      </Text>
    </Card>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: keyof ColorTokens }) {
  return (
    <View style={styles.total}>
      <Text variant="headline" color={color} tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  dayOffCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  actions: { gap: spacing.sm },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  lastCard: { gap: spacing.sm },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timelineCard: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  totals: { flexDirection: 'row', gap: spacing.sm },
  total: { flex: 1, gap: 2 },
  periodCard: { gap: spacing.md },
  weekCard: { gap: spacing.sm },
  weekTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  weekFill: { height: '100%', borderRadius: radius.full },
});
