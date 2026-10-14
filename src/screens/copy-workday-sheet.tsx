import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TimelineBar } from '@/components/workday/timeline-bar';
import { useDbQuery } from '@/hooks/use-db-query';
import { addDaysToKey, fromDateKey, toDateKey } from '@/domain/time';
import type { DateKey } from '@/domain/types';
import { summarizeWorkday } from '@/domain/workday';
import { getWorkday } from '@/db/workday-repo';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { copyWorkdayToDates, type CopyResult } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme } from '@/theme';

import { SheetContainer } from './sheet-container';

// Copiar a jornada de um dia para um ou vários outros dias (mesmos horários de relógio).

export function CopyWorkdaySheet({ workdayId }: { workdayId: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { data: source } = useDbQuery((d) => getWorkday(d, workdayId), [workdayId]);
  const [dates, setDates] = useState<DateKey[]>([]);
  const [picking, setPicking] = useState(false);
  const [today] = useState(() => toDateKey(Date.now()));

  if (!source) return <SheetContainer />;

  const summary = summarizeWorkday(source.punches);
  const first = source.punches[0];
  const last = source.punches.at(-1);
  const add = (date: DateKey) => {
    if (date > today || date === source.refDate || dates.includes(date)) return;
    Haptics.selectionAsync().catch(() => {});
    setDates((list) => [...list, date].sort());
  };

  // Atalhos relativos ao dia da jornada (só datas que já passaram)
  const shortcuts = [
    { label: 'Dia anterior', date: addDaysToKey(source.refDate, -1) },
    { label: 'Dia seguinte', date: addDaysToKey(source.refDate, 1) },
    { label: 'Semana anterior', date: addDaysToKey(source.refDate, -7) },
    { label: 'Semana seguinte', date: addDaysToKey(source.refDate, 7) },
  ].filter((s) => s.date <= today && !dates.includes(s.date));

  async function copy() {
    let result: CopyResult;
    try {
      result = await copyWorkdayToDates(db, workdayId, dates);
    } catch (e) {
      Alert.alert('Não foi possível copiar', (e as Error).message);
      return;
    }
    const { created, skipped, undo } = result;
    if (created.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(
        `Copiada para ${created.length} ${created.length === 1 ? 'dia' : 'dias'}${skipped.length ? ` · ${skipped.length} pulado` : ''}`,
        { actions: [{ label: 'Desfazer', onPress: () => undo() }] },
      );
    }
    if (skipped.length > 0) {
      Alert.alert(
        created.length ? 'Alguns dias foram pulados' : 'Nenhum dia copiado',
        skipped.map((s) => `• ${formatShortDate(s.date)}: ${s.reason}`).join('\n'),
      );
    }
  }

  return (
    <SheetContainer>
      <View style={styles.gapSm}>
        <Text variant="title2">Copiar jornada</Text>
        <Text variant="caption" color="textMuted" tabular>
          {formatShortDate(source.refDate)} · {first ? formatTime(first.at) : ''} → {last ? formatTime(last.at) : ''} ·{' '}
          {summary.segments.length} {summary.segments.length === 1 ? 'turno' : 'turnos'} · {formatDuration(summary.workedMs)}
        </Text>
        <TimelineBar refDate={source.refDate} segments={summary.segments} />
      </View>

      <Text variant="micro" color="textMuted">
        Para os dias
      </Text>
      <View style={styles.chips}>
        {dates.map((d) => (
          <PressableScale
            key={d}
            accessibilityRole="button"
            accessibilityLabel={`Remover ${formatShortDate(d)}`}
            onPress={() => setDates((list) => list.filter((x) => x !== d))}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          >
            <Text variant="caption">{formatShortDate(d)}</Text>
            <Icon name="close" size={20} color="textMuted" />
          </PressableScale>
        ))}
        <PressableScale
          accessibilityRole="button"
          onPress={() => setPicking(true)}
          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="add" size={20} color="primary" />
          <Text variant="caption" color="primary">
            Escolher dia
          </Text>
        </PressableScale>
      </View>

      {shortcuts.length > 0 ? (
        <View style={styles.chips}>
          {shortcuts.map((s) => (
            <Button key={s.label} label={`${s.label} (${s.date.slice(8)}/${s.date.slice(5, 7)})`} variant="ghost" size="sm" onPress={() => add(s.date)} />
          ))}
        </View>
      ) : null}

      <Button
        label={dates.length === 0 ? 'Escolha pelo menos um dia' : `Copiar para ${dates.length} ${dates.length === 1 ? 'dia' : 'dias'}`}
        icon="content_copy"
        size="lg"
        block
        disabled={dates.length === 0}
        onPress={copy}
      />

      {picking && (
        <DateTimePicker
          value={fromDateKey(addDaysToKey(source.refDate, 1) <= today ? addDaysToKey(source.refDate, 1) : today)}
          mode="date"
          maximumDate={new Date()}
          accentColor={colors.primary}
          onValueChange={(_, d) => {
            setPicking(false);
            add(toDateKey(d));
          }}
          onDismiss={() => setPicking(false)}
        />
      )}
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  gapSm: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouch - 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
});
