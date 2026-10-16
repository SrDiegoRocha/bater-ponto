import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, { FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { PeriodSwipe } from '@/components/period/period-swipe';
import { filterWorkdays, type HistoryFilter } from '@/domain/history-filter';
import type { Choice } from '@/components/ui';
import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Button, Card, EmptyState, FilterChips, Icon, Screen, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { WorkdayRow } from '@/components/workday/workday-row';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { nightMs } from '@/domain/night-hours';
import { addDaysToKey, MINUTE, toDateKey } from '@/domain/time';
import type { DateKey } from '@/domain/types';
import { weekStart } from '@/domain/work-rules';
import { formatDayRange, formatDuration, formatShortDate } from '@/lib/format';
import { removeWorkday } from '@/services/punch-service';
import { useSettings } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme, type ColorTokens } from '@/theme';

// Histórico (§5.3): calendário do período + jornadas agrupadas por semana. Toque longo no calendário = seleção múltipla.

const FILTERS: Choice<HistoryFilter>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'overtime', label: 'Com extra', icon: 'more_time', color: 'extra' },
  { value: 'incomplete', label: 'Incompletas', icon: 'error', color: 'danger' },
  { value: 'holiday', label: 'Feriados', icon: 'celebration', color: 'holiday' },
  { value: 'night', label: 'Noturnas', icon: 'dark_mode', color: 'night' },
];

export function History() {
  const db = useSQLiteContext();
  const { workRules } = useSettings();
  const period = useSelectedPeriod();
  const { stats, workdays, dayOffs, holidays, now } = usePeriodStats(period);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const ctx = stats ? { summaries: stats.summaries, holidays, dayOffs, overtime: stats.overtime } : null;
  const shown = ctx ? filterWorkdays(workdays, filter, ctx) : workdays;
  const filters = FILTERS.map((f) => ({ ...f, count: ctx ? filterWorkdays(workdays, f.value, ctx).length : undefined }))
    // Filtro sem nenhuma jornada só aparece se estiver selecionado
    .filter((f) => f.value === 'all' || f.value === filter || (f.count ?? 0) > 0);
  const [selected, setSelected] = useState<Set<DateKey>>(new Set());
  const today = toDateKey(now);
  const selecting = selected.size > 0;

  const toggle = (date: DateKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const openDay = (date: DateKey) => {
    if (selecting) return toggle(date);
    const status = stats?.days.get(date);
    if (status?.type === 'worked' && status.workdayIds.length === 1) {
      router.push(`/jornada/${status.workdayIds[0]}`);
    } else {
      router.push({ pathname: '/folga', params: { dates: date } });
    }
  };

  const fillSelected = () => {
    router.push({ pathname: '/aplicar', params: { dates: [...selected].sort().join(',') } });
    setSelected(new Set());
  };

  const markSelected = () => {
    router.push({ pathname: '/folga', params: { dates: [...selected].join(',') } });
    setSelected(new Set());
  };

  // Extras são do dia: ficam na primeira jornada listada de cada data
  const extraOwner = new Map<DateKey, string>();
  for (const w of shown) if (!extraOwner.has(w.refDate)) extraOwner.set(w.refDate, w.id);

  // Agrupa por semana (segunda a domingo), na ordem da lista (mais recente primeiro)
  const weeks: { start: DateKey; items: typeof shown }[] = [];
  for (const w of shown) {
    const start = weekStart(w.refDate);
    const group = weeks.at(-1);
    if (group && group.start === start) group.items.push(w);
    else weeks.push({ start, items: [w] });
  }

  return (
    <View style={styles.flex}>
      <Screen
        title="Histórico"
        headerRight={
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Registrar jornada"
            onPress={() => router.push('/jornada/nova')}
            style={styles.iconButton}
          >
            <Icon name="add" color="primary" size={28} />
          </PressableScale>
        }
      >
        <PeriodSwitcher period={period} />

        <PeriodSwipe>
          <Card>
            {stats ? (
              <CalendarGrid
                period={period}
                days={stats.days}
                overtime={stats.overtime}
                today={today}
                selected={selected}
                onPressDay={openDay}
                onLongPressDay={toggle}
              />
            ) : (
              <View style={styles.calendarPlaceholder} />
            )}
            <Legend />
          </Card>
        </PeriodSwipe>
        <Text variant="caption" color="textMuted" align="center">
          Toque num dia para ver, marcar folga ou feriado. Segure para selecionar vários.
        </Text>

        <View style={styles.listHeader}>
          <Text variant="micro" color="textMuted" accessibilityRole="header">
            Jornadas
          </Text>
          <Text variant="caption" color="textMuted" tabular>
            {filter === 'all' ? `${workdays.length} no período` : `${shown.length} de ${workdays.length}`}
          </Text>
        </View>
        {workdays.length > 0 ? <FilterChips options={filters} value={filter} onChange={setFilter} /> : null}

        {shown.length === 0 && filter !== 'all' ? (
          <EmptyState illustration="done" title="Nenhuma jornada com esse filtro" />
        ) : workdays.length === 0 ? (
          <EmptyState illustration="period" title="Nenhuma jornada neste período" description="Anote as batidas na tela Hoje ou registre uma jornada pelo +." />
        ) : (
          weeks.map((week) => {
            const workedMs = week.items.reduce((sum, w) => {
              const s = stats?.summaries.get(w.id);
              return sum + (s && w.status !== 'incomplete' && s.isConsistent ? s.workedMs : 0);
            }, 0);
            const weeklyLimitMs = workRules.weeklyLimitMinutes * MINUTE;
            const over = workedMs > weeklyLimitMs;
            return (
              <View key={week.start} style={styles.week}>
                <View style={styles.weekHeader}>
                  <Text variant="micro" color="textMuted" style={styles.weekLabel}>
                    Semana · {formatDayRange(week.start, addDaysToKey(week.start, 6))}
                  </Text>
                  <Text variant="caption" color={over ? 'extra' : 'text'} tabular style={styles.weekTotal}>
                    {formatDuration(workedMs)}
                    <Text variant="caption" color="textMuted"> de {formatDuration(weeklyLimitMs)}</Text>
                  </Text>
                </View>
                {week.items.map((w, i) => {
                  const s = stats?.summaries.get(w.id);
                  if (!s) return null;
                  const o = extraOwner.get(w.refDate) === w.id ? stats?.overtime.get(w.refDate) : undefined;
                  return (
                    <Animated.View key={w.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)} exiting={FadeOut} layout={LinearTransition}>
                      <WorkdayRow
                        workday={w}
                        summary={s}
                        extraMs={o ? o.extraMs + o.extraDoubleMs : 0}
                        premium={!!o && o.extraDoubleMs > 0}
                        holidayName={holidays.get(w.refDate)?.name ?? null}
                        night={s.segments.some((seg) => nightMs(seg) > 0)}
                        onPress={() => router.push(`/jornada/${w.id}`)}
                        onDelete={async () => {
                          const undo = await removeWorkday(db, w.id);
                          showToast(`Jornada de ${formatShortDate(w.refDate)} excluída`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
                        }}
                      />
                    </Animated.View>
                  );
                })}
              </View>
            );
          })
        )}
        {selecting ? <View style={styles.selectionSpacer} /> : null}
      </Screen>

      {selecting ? (
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.selectionBar}>
          <Card variant="raised" style={styles.selectionCard}>
            <View style={styles.selectionTop}>
              <Text variant="headline" style={styles.flex}>
                {selected.size} {selected.size === 1 ? 'dia selecionado' : 'dias selecionados'}
              </Text>
              <Button label="Cancelar" variant="ghost" size="sm" onPress={() => setSelected(new Set())} />
            </View>
            <View style={styles.selectionActions}>
              <View style={styles.flex}>
                <Button label="Preencher" icon="edit_calendar" variant="secondary" block onPress={fillSelected} />
              </View>
              <View style={styles.flex}>
                <Button label="Folga/feriado" icon="beach_access" block onPress={markSelected} />
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Legend() {
  const items: { label: string; color: keyof ColorTokens; ring?: boolean }[] = [
    { label: 'Trabalhado', color: 'work' },
    { label: 'Com extra', color: 'extra' },
    { label: 'Folga', color: 'dayOff' },
    { label: 'Férias', color: 'vacation' },
    { label: 'Atestado', color: 'sickLeave' },
    { label: 'Feriado', color: 'holiday', ring: true },
  ];
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <LegendItem key={i.label} {...i} />
      ))}
    </View>
  );
}

function LegendItem({ label, color, ring }: { label: string; color: keyof ColorTokens; ring?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, ring ? { borderWidth: 2, borderColor: colors[color] } : { backgroundColor: colors[color] }]} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  calendarPlaceholder: { height: 320 },
  // Legenda em grade de 3 colunas: alinhada, sem sobrar espaço torto à direita
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm, marginTop: spacing.md },
  legendItem: { width: '33.33%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.full },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: spacing.sm },
  week: { gap: spacing.sm },
  weekHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: 2, paddingHorizontal: spacing.xs, paddingTop: spacing.xs },
  weekLabel: { flexGrow: 1, flexShrink: 1 },
  weekTotal: { flexShrink: 0 },
  selectionSpacer: { height: 120 },
  selectionBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  selectionCard: { gap: spacing.sm, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' },
  selectionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectionActions: { flexDirection: 'row', gap: spacing.sm },
});
