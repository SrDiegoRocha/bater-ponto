import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { TimeField } from '@/components/time/time-field';
import { Button, Card, Icon, Screen, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { fromDateKey, toDateKey } from '@/domain/time';
import { resolveSequence, type MinuteOfDay } from '@/domain/time-of-day';
import { summarizeWorkday } from '@/domain/workday';
import { formatDuration, formatShortDate } from '@/lib/format';
import { createManualWorkday } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme } from '@/theme';

// Jornada inteira cadastrada à mão (R11): data + turnos. Horários que "voltam" viram o dia seguinte.

type Shift = { start: MinuteOfDay; end: MinuteOfDay };

export function NewWorkday({ initialDate }: { initialDate?: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [date, setDate] = useState(() => initialDate ?? toDateKey(Date.now()));
  const [shifts, setShifts] = useState<Shift[]>([{ start: 8 * 60, end: 12 * 60 }]);
  const [pickingDate, setPickingDate] = useState(false);

  const minutes = shifts.flatMap((s) => [s.start, s.end]);
  const instants = resolveSequence(fromDateKey(date).getTime(), minutes);
  const summary = summarizeWorkday(
    instants.map((at, i) => ({ kind: i % 2 === 0 ? ('in' as const) : ('out' as const), at })),
  );
  const isNextDay = (i: number) => toDateKey(instants[i]) !== date;

  const update = (index: number, patch: Partial<Shift>) =>
    setShifts((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  function addShift() {
    const lastEnd = shifts.at(-1)!.end;
    setShifts((list) => [...list, { start: (lastEnd + 60) % 1440, end: (lastEnd + 180) % 1440 }]);
  }

  async function save() {
    try {
      const pairs = shifts.map((_, i) => ({ start: instants[i * 2], end: instants[i * 2 + 1] }));
      const { workdayId, undo } = await createManualWorkday(db, pairs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/jornada/${workdayId}`);
      showToast(`Jornada de ${formatShortDate(date)} registrada`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
    } catch (e) {
      Alert.alert('Não foi possível salvar', (e as Error).message);
    }
  }

  return (
    <Screen nativeHeader>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Data: ${formatShortDate(date)}. Tocar para mudar.`}
        onPress={() => setPickingDate(true)}
        style={[styles.dateButton, { backgroundColor: colors.surface }]}
      >
        <Icon name="calendar_today" color="primary" />
        <Text variant="headline" style={styles.flex}>
          {formatShortDate(date)}
        </Text>
        <Icon name="expand_more" color="textMuted" />
      </PressableScale>

      {shifts.map((shift, i) => (
        <Card key={i} style={styles.shift}>
          <View style={styles.shiftHeader}>
            <Text variant="micro" color="textMuted">
              Turno {i + 1}
            </Text>
            {shifts.length > 1 ? (
              <Button
                label="Remover"
                variant="destructive"
                size="sm"
                onPress={() => setShifts((list) => list.filter((_, j) => j !== i))}
              />
            ) : null}
          </View>
          <TimeField label="Entrada" value={shift.start} onChange={(v) => update(i, { start: v })} nextDay={isNextDay(i * 2)} />
          <TimeField label="Saída" value={shift.end} onChange={(v) => update(i, { end: v })} nextDay={isNextDay(i * 2 + 1)} />
        </Card>
      ))}

      <Button label="Adicionar turno" icon="add" variant="secondary" block onPress={addShift} />

      <Text variant="body" color="textMuted" align="center" tabular>
        Trabalhado {formatDuration(summary.workedMs)} · Intervalo {formatDuration(summary.breakMs)}
      </Text>
      <Button label="Salvar jornada" size="lg" block onPress={save} />

      {pickingDate && (
        <DateTimePicker
          value={fromDateKey(date)}
          mode="date"
          maximumDate={new Date()}
          accentColor={colors.primary}
          onValueChange={(_, d) => {
            setPickingDate(false);
            setDate(toDateKey(d));
          }}
          onDismiss={() => setPickingDate(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouch + spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  shift: { gap: spacing.sm },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
