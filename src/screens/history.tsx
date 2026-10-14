import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Button, Card, EmptyState, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TimelineBar } from '@/components/workday/timeline-bar';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { toDateKey } from '@/domain/time';
import type { DateKey } from '@/domain/types';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { minTouch, radius, spacing, useTheme, type ColorTokens } from '@/theme';

// Histórico (§5.3): calendário do período + lista de jornadas. Toque longo no calendário = seleção múltipla.

export function History() {
  const period = useSelectedPeriod();
  const { stats, workdays, now } = usePeriodStats(period);
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
        <Text variant="caption" color="textMuted" align="center">
          Toque num dia para ver ou marcar folga. Segure para selecionar vários.
        </Text>

        <SectionHeader title={`Jornadas · ${workdays.length}`} />
        {workdays.length === 0 ? (
          <EmptyState title="Nenhuma jornada neste período" description="Bata o ponto na tela Hoje ou registre uma jornada pelo +." />
        ) : (
          workdays.map((w) => {
            const s = stats?.summaries.get(w.id);
            if (!s) return null;
            const first = w.punches[0];
            const last = w.punches.at(-1);
            const crosses = last && toDateKey(last.at) !== w.refDate;
            const incomplete = w.status === 'incomplete' || !s.isConsistent;
            return (
              <PressableScale key={w.id} scaleTo={0.98} onPress={() => router.push(`/jornada/${w.id}`)} accessibilityRole="button">
                <Card style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text variant="headline">{formatShortDate(w.refDate)}</Text>
                    <Text variant="body" tabular color={incomplete ? 'danger' : 'text'}>
                      {incomplete ? 'Incompleta' : formatDuration(s.workedMs)}
                    </Text>
                  </View>
                  <Text variant="caption" color="textMuted" tabular>
                    {first ? formatTime(first.at) : '--:--'} → {w.status === 'open' ? 'agora' : last ? formatTime(last.at) : '--:--'}
                    {crosses ? ' +1' : ''} · intervalo {formatDuration(s.breakMs)} · {s.segments.length}{' '}
                    {s.segments.length === 1 ? 'turno' : 'turnos'}
                  </Text>
                  <TimelineBar refDate={w.refDate} segments={s.segments} />
                </Card>
              </PressableScale>
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
            <Button label="Marcar folga" icon="beach_access" size="sm" onPress={markSelected} />
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
  row: { gap: spacing.sm },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.full },
  selectionBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  selectionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' },
});
