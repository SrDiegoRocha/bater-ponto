import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { dayOffLabel } from '@/components/calendar/calendar-grid';
import { Button, Card, ChoiceChips, Icon, PressableScale, Screen, Text } from '@/components/ui';
import { useSelectedPeriod } from '@/hooks/use-period-stats';
import { useTimesheetCheck } from '@/hooks/use-timesheet-check';
import { periodLabel, periodRangeLabel } from '@/domain/period';
import type { DayStatus } from '@/domain/stats';
import { buildDiffText, DAY_DIFF_TOLERANCE_MS, type CheckDay } from '@/domain/timesheet-check';
import { deleteDayCheck, saveDayChecks } from '@/db/day-check-repo';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { bumpData } from '@/stores/data-store';
import { minTouch, radius, spacing, useTheme } from '@/theme';

// Conferência do espelho de ponto, dia a dia (§ conferência): cada dia do período com as batidas
// anotadas; o usuário compara com o espelho da empresa e marca "bate" ou abre o dia para anotar a diferença.

type Filter = 'all' | 'pending' | 'diff';

export function TimesheetCheck() {
  const db = useSQLiteContext();
  const period = useSelectedPeriod();
  const data = useTimesheetCheck(period);
  const [filter, setFilter] = useState<Filter>('all');

  if (!data) return <Screen nativeHeader />;
  const { days, summary, dayStatus } = data;

  const shown = days.filter((d) =>
    filter === 'pending' ? !d.check : filter === 'diff' ? d.check?.status === 'diff' : true,
  );

  async function toggleOk(day: CheckDay) {
    Haptics.selectionAsync().catch(() => {});
    if (day.check?.status === 'ok') await deleteDayCheck(db, day.date);
    else await saveDayChecks(db, [{ date: day.date, status: 'ok', companyWorkedMs: null, note: null }]);
    bumpData();
  }

  function markPendingOk() {
    const pending = days.filter((d) => !d.check);
    Alert.alert(
      `Marcar ${pending.length} ${pending.length === 1 ? 'dia' : 'dias'} como "bate"?`,
      'Use depois de conferir o espelho inteiro e só sobrarem dias iguais.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar',
          onPress: async () => {
            await saveDayChecks(
              db,
              pending.map((d) => ({ date: d.date, status: 'ok' as const, companyWorkedMs: null, note: null })),
            );
            bumpData();
          },
        },
      ],
    );
  }

  function share() {
    const message = buildDiffText(period, days, { date: formatShortDate, time: formatTime, duration: formatDuration });
    Share.share({ message }).catch(() => {});
  }

  return (
    <Screen nativeHeader>
      <View style={styles.gapXs}>
        <Text variant="headline">
          {periodLabel(period)} · {periodRangeLabel(period)}
        </Text>
        <Text variant="body" color="textMuted">
          Abra o espelho de ponto da empresa e confira dia a dia. Toque no ✓ quando bater, ou no dia para anotar a diferença.
        </Text>
      </View>

      <Card style={styles.gap}>
        <Text variant="title2" tabular>
          {summary.checked} de {summary.total} dias conferidos
        </Text>
        <Text variant="body" color={summary.diffs > 0 ? 'danger' : 'textMuted'} tabular>
          {summary.diffs === 0
            ? 'Nenhuma diferença até agora'
            : `${summary.diffs} ${summary.diffs === 1 ? 'dia diferente' : 'dias diferentes'}${
                summary.diffMs !== 0 ? ` · espelho com ${formatDuration(Math.abs(summary.diffMs))} a ${summary.diffMs < 0 ? 'menos' : 'mais'}` : ''
              }`}
        </Text>
        {summary.diffs > 0 ? <Button label="Enviar diferenças para o RH" icon="share" variant="secondary" block onPress={share} /> : null}
        {summary.pending > 0 && summary.checked > 0 ? (
          <Button label="Marcar os pendentes como “bate”" icon="done_all" variant="ghost" size="sm" onPress={markPendingOk} />
        ) : null}
      </Card>

      <ChoiceChips
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'pending', label: `A conferir (${summary.pending})` },
          { value: 'diff', label: `Diferentes (${summary.diffs})` },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {shown.map((day) => (
        <DayRow key={day.date} day={day} status={dayStatus.get(day.date)} onToggleOk={() => toggleOk(day)} />
      ))}
      {shown.length === 0 ? (
        <Text variant="body" color="textMuted" align="center">
          {filter === 'pending' ? 'Todos os dias foram conferidos.' : 'Nenhum dia diferente.'}
        </Text>
      ) : null}
    </Screen>
  );
}

function emptyLabel(status: DayStatus | undefined): string {
  if (status?.type === 'dayOff') return dayOffLabel[status.kind];
  if (status?.type === 'holiday') return `Feriado · ${status.holiday.name}`;
  return 'Nada anotado';
}

function DayRow({ day, status, onToggleOk }: { day: CheckDay; status: DayStatus | undefined; onToggleOk: () => void }) {
  const { colors } = useTheme();
  const ok = day.check?.status === 'ok';
  const diff = day.check?.status === 'diff';
  const times = day.punches.map((p) => formatTime(p.at)).join(' · ');

  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${formatShortDate(day.date)}. Tocar para anotar diferença.`}
      onPress={() => router.push({ pathname: '/espelho-dia', params: { date: day.date } })}
    >
      <Card style={[styles.row, diff && { borderColor: colors.danger, borderWidth: 1 }]}>
        <View style={styles.flex}>
          <View style={styles.rowHeader}>
            <Text variant="headline">{formatShortDate(day.date)}</Text>
            <Text variant="body" tabular color={day.incomplete ? 'danger' : 'text'}>
              {day.incomplete ? 'Incompleta' : day.punches.length ? formatDuration(day.workedMs) : ''}
            </Text>
          </View>
          <Text variant="caption" color="textMuted" tabular>
            {times || emptyLabel(status)}
          </Text>
          {diff ? (
            <Text variant="caption" color="danger" tabular numberOfLines={2}>
              {day.diffMs !== null && Math.abs(day.diffMs) >= DAY_DIFF_TOLERANCE_MS
                ? `Espelho ${formatDuration(day.diffMs, { signed: true })}`
                : 'Diferente'}
              {day.check?.note ? ` · ${day.check.note}` : ''}
            </Text>
          ) : null}
        </View>
        {diff ? (
          <Icon name="error" color="danger" />
        ) : (
          <PressableScale
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ok }}
            accessibilityLabel={`${formatShortDate(day.date)} bate com o espelho`}
            onPress={onToggleOk}
            style={[styles.check, { backgroundColor: ok ? colors.work : 'transparent', borderColor: ok ? colors.work : colors.border }]}
          >
            <Icon name="check" color={ok ? 'onPrimary' : 'textMuted'} size={24} />
          </PressableScale>
        )}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  gap: { gap: spacing.sm },
  gapXs: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  check: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

