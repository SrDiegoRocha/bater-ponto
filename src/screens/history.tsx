import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, { FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { PeriodSwipe } from '@/components/period/period-swipe';
import { filterWorkdays, type HistoryFilter } from '@/domain/history-filter';
import { useSettings } from '@/stores/settings-store';
import type { Choice } from '@/components/ui';
import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Button, Card, ChoiceChips, EmptyState, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { WorkdayRow } from '@/components/workday/workday-row';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { toDateKey } from '@/domain/time';
import type { DateKey } from '@/domain/types';
import { formatShortDate } from '@/lib/format';
import { removeWorkday } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme, type ColorTokens } from '@/theme';

// Histórico (§5.3): calendário do período + lista de jornadas. Toque longo no calendário = seleção múltipla.

const FILTERS: Choice<HistoryFilter>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'overtime', label: 'Com extra', icon: 'trending_up', color: 'work' },
  { value: 'incomplete', label: 'Incompletas', icon: 'error', color: 'danger' },
  { value: 'holiday', label: 'Feriados', icon: 'celebration', color: 'holiday' },
  { value: 'night', label: 'Noturnas', icon: 'dark_mode', color: 'night' },
];

export function History() {
  const db = useSQLiteContext();
  const period = useSelectedPeriod();
  const { stats, workdays, dayOffs, holidays, now } = usePeriodStats(period);
  const { dailyGoal } = useSettings();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const shown = stats ? filterWorkdays(workdays, filter, { summaries: stats.summaries, holidays, dayOffs, goal: dailyGoal }) : workdays;
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
          Toque num dia para ver ou marcar folga. Segure para selecionar vários.
        </Text>

        <SectionHeader title={`Jornadas · ${shown.length}${filter !== 'all' ? ` de ${workdays.length}` : ''}`} />
        <ChoiceChips options={FILTERS} value={filter} onChange={setFilter} />
        {shown.length === 0 && filter !== 'all' ? (
          <EmptyState illustration="done" title="Nenhuma jornada com esse filtro" />
        ) : workdays.length === 0 ? (
          <EmptyState illustration="period" title="Nenhuma jornada neste período" description="Bata o ponto na tela Hoje ou registre uma jornada pelo +." />
        ) : (
          shown.map((w, i) => {
            const s = stats?.summaries.get(w.id);
            if (!s) return null;
            return (
              <Animated.View key={w.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)} exiting={FadeOut} layout={LinearTransition}>
                <WorkdayRow
                  workday={w}
                  summary={s}
                  onPress={() => router.push(`/jornada/${w.id}`)}
                  onDelete={async () => {
                    const undo = await removeWorkday(db, w.id);
                    showToast(`Jornada de ${formatShortDate(w.refDate)} excluída`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
                  }}
                />
              </Animated.View>
            );
          })
        )}
      </Screen>

      {selecting ? (
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.selectionBar}>
          <Card variant="raised" style={styles.selectionCard}>
            <Text variant="headline" style={styles.flex}>
              {selected.size} {selected.size === 1 ? 'dia' : 'dias'}
            </Text>
            <Button label="Cancelar" variant="ghost" size="sm" onPress={() => setSelected(new Set())} />
            <Button label="Preencher" icon="edit_calendar" variant="secondary" size="sm" onPress={fillSelected} />
            <Button label="Folga" icon="beach_access" size="sm" onPress={markSelected} />
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Legend() {
  const items: { label: string; color: keyof ColorTokens; ring?: boolean }[] = [
    { label: 'Trabalhado', color: 'work' },
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
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.full },
  selectionBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  selectionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' },
});
