import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Icon, ProgressRing, Screen, StatusPill, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { dayOffLabel } from '@/components/calendar/calendar-grid';
import { Timeline } from '@/components/workday/timeline';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useCurrentPeriod, usePeriodStats } from '@/hooks/use-period-stats';
import { goalForDate } from '@/domain/balance';
import { periodDates, periodLabel, periodRangeLabel } from '@/domain/period';
import { simpleGrossCents } from '@/domain/salary';
import { actionsByState, deriveDayState, type DayAction } from '@/domain/state-machine';
import { HOUR, toDateKey } from '@/domain/time';
import { MIN_REST_MS } from '@/domain/validation';
import { summarizeWorkday } from '@/domain/workday';
import { countIncompleteWorkdays, getOpenWorkday, listRecentWorkdays } from '@/db/workday-repo';
import { formatDuration, formatLongDay, formatMoney, formatShortDate, formatTime } from '@/lib/format';
import { clearDayOffs, performDayAction } from '@/services/punch-service';
import { useSettings } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { minTouch, spacing } from '@/theme';

import { LiveClock } from './live-clock';
import { PunchButton, PunchHint } from './punch-button';

const toastMessage: Record<DayAction, string> = {
  startDay: 'Dia iniciado às',
  pause: 'Pausado às',
  resume: 'Voltou às',
  endDay: 'Dia encerrado às',
};

const DEBOUNCE_MS = 3000; // R7

/** R7: ignora toques repetidos logo após bater o ponto */
function tryAcquire(lastPress: { current: number }): boolean {
  const t = Date.now();
  if (t - lastPress.current < DEBOUNCE_MS) return false;
  lastPress.current = t;
  return true;
}
const OPEN_ALERT_MS = 16 * HOUR;

export function Today() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const now = useNow();
  const today = toDateKey(now);
  const period = useCurrentPeriod();
  const { stats } = usePeriodStats(period);
  const lastPress = useRef(0);

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
  const actions = actionsByState[state];

  // Jornada mostrada: a aberta, ou a última se ela começou ou terminou hoje
  const lastClosed = data?.recent.find((w) => w.status === 'closed') ?? null;
  const lastEnd = lastClosed?.punches.at(-1)?.at ?? null;
  const shown =
    open ??
    (lastClosed && (lastClosed.refDate === today || (lastEnd !== null && toDateKey(lastEnd) === today)) ? lastClosed : null);
  const summary = shown ? summarizeWorkday(shown.punches, now) : null;

  const runningSegment = summary?.segments.find((s) => s.open) ?? null;
  const closedMs = (summary?.workedMs ?? 0) - (runningSegment ? runningSegment.end - runningSegment.start : 0);

  const dayStatus = stats?.days.get(today);
  const todayDayOff = dayStatus?.type === 'dayOff' ? dayStatus.kind : null;
  const holiday = dayStatus && 'holiday' in dayStatus ? dayStatus.holiday : null;
  const goal = goalForDate(today, settings.dailyGoal) || settings.dailyGoal.defaultMinutes * 60_000;
  const progress = goal > 0 ? (summary?.workedMs ?? 0) / goal : 0;

  const restMs = state === 'off' && lastEnd !== null ? now - lastEnd : null;
  const openForMs = open?.punches[0] ? now - open.punches[0].at : 0;
  const daysLeft = periodDates(period).filter((d) => d >= today).length;

  async function act(action: DayAction) {
    if (!tryAcquire(lastPress)) return;
    try {
      const result = await performDayAction(db, action);
      const punch = (await db.getFirstAsync<{ at: number }>('SELECT at FROM punch WHERE id = ?', result.punchId))!;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`${toastMessage[action]} ${formatTime(punch.at)}`, {
        actions: [
          { label: 'Ajustar', onPress: () => router.push(`/batida/${result.punchId}`) },
          { label: 'Desfazer', onPress: () => result.undo() },
        ],
      });
    } catch (e) {
      lastPress.current = 0;
      Alert.alert('Não foi possível bater o ponto', (e as Error).message);
    }
  }

  async function workAnyway() {
    await clearDayOffs(db, [today]);
    await act('startDay');
  }

  return (
    <Screen
      title={formatLongDay(today)}
      subtitle={`${periodLabel(period)} · ${periodRangeLabel(period)} · faltam ${daysLeft} dias`}
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
          description="Esqueceu de encerrar o dia?"
          actionLabel="Revisar"
          onPress={() => router.push(`/jornada/${open.id}`)}
        />
      ) : null}

      {holiday ? <StatusPill status="holiday" label={`Feriado · ${holiday.name}`} /> : null}

      <View style={styles.hero}>
        <ProgressRing progress={progress} size={260} color={state === 'break' ? 'break' : 'work'}>
          <View style={styles.ringContent}>
            <LiveClock baseMs={closedMs} runningSince={runningSegment?.start ?? null} />
            <StatusPill status={state === 'working' ? 'work' : state === 'break' ? 'break' : 'off'} />
            <Text variant="caption" color="textMuted" tabular>
              meta {formatDuration(goal)}
            </Text>
          </View>
        </ProgressRing>
      </View>

      {todayDayOff && state === 'off' ? (
        <Card style={styles.dayOffCard}>
          <Text variant="headline">Hoje é {dayOffLabel[todayDayOff].toLowerCase()} 🌴</Text>
          <Button label="Trabalhar mesmo assim" variant="ghost" size="sm" onPress={workAnyway} />
        </Card>
      ) : (
        <>
          <PunchButton
            state={state}
            onPress={() => act(actions.primary)}
            onLongPress={() => router.push({ pathname: '/bater', params: { action: actions.primary } })}
          />
          {actions.secondary ? (
            <Button label="Encerrar dia" icon="stop" variant="secondary" block onPress={() => act('endDay')} />
          ) : (
            <Button
              label="Marcar folga hoje"
              icon="beach_access"
              variant="ghost"
              onPress={() => router.push({ pathname: '/folga', params: { dates: today } })}
            />
          )}
          <PunchHint />
        </>
      )}

      {state === 'off' && lastClosed && lastEnd !== null && shown !== lastClosed ? (
        <Card style={styles.gapSm}>
          <Text variant="micro" color="textMuted">
            Última jornada
          </Text>
          <Text variant="body" tabular>
            {formatShortDate(lastClosed.refDate)} · {formatTime(lastClosed.punches[0].at)} → {formatTime(lastEnd)} ·{' '}
            {formatDuration(summarizeWorkday(lastClosed.punches, now).workedMs)}
          </Text>
          {restMs !== null ? (
            <Text variant="caption" color={restMs < MIN_REST_MS ? 'break' : 'textMuted'} tabular>
              Descansando há {formatDuration(restMs)}
              {restMs < MIN_REST_MS ? ' · abaixo das 11h de interjornada' : ''}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {shown && shown.punches.length > 0 ? (
        <Card>
          <View style={styles.cardHeader}>
            <Text variant="micro" color="textMuted">
              Linha do tempo
            </Text>
            <Button label="Detalhes" variant="ghost" size="sm" onPress={() => router.push(`/jornada/${shown.id}`)} />
          </View>
          <Timeline punches={shown.punches} now={now} onPressPunch={(p) => router.push(`/batida/${p.id}`)} />
          {summary ? (
            <Text variant="caption" color="textMuted" tabular style={styles.totals}>
              Trabalhado {formatDuration(summary.workedMs)} · Intervalo {formatDuration(summary.breakMs)}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {stats ? (
        <PressableScale scaleTo={0.98} onPress={() => router.navigate('/resumo')} accessibilityRole="button">
          <Card style={styles.gapSm}>
            <Text variant="micro" color="textMuted">
              Período · {periodRangeLabel(period)}
            </Text>
            <Text variant="title2" tabular>
              {formatDuration(stats.workedMs)} trabalhadas
            </Text>
            <Text variant="caption" color="textMuted" tabular>
              {stats.daysWorked} dias · {stats.dayOffTotal} folgas · banco {formatDuration(stats.balanceMs, { signed: true })}
              {settings.hourlyRate > 0 ? ` · ${formatMoney(simpleGrossCents(stats.workedMs, settings.hourlyRate))}` : ''}
            </Text>
          </Card>
        </PressableScale>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.md },
  ringContent: { alignItems: 'center', gap: spacing.sm },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  dayOffCard: { alignItems: 'center', gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  totals: { marginTop: spacing.md },
  gapSm: { gap: spacing.xs },
});
