import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { TimeField } from '@/components/time/time-field';
import { Button, Card, Icon, Screen, StatusPill, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { checkBreak, describeBreakIssue } from '@/domain/break-rules';
import { holidaysInRange } from '@/domain/holidays';
import { fromDateKey, MINUTE, toDateKey } from '@/domain/time';
import { resolveSequence, type MinuteOfDay } from '@/domain/time-of-day';
import { summarizeWorkday } from '@/domain/workday';
import { listHolidayOverrides } from '@/db/holiday-repo';
import { listTemplates } from '@/db/template-repo';
import { useDbQuery } from '@/hooks/use-db-query';
import { formatDuration, formatLongDay, formatShortDate } from '@/lib/format';
import { createManualWorkday } from '@/services/punch-service';
import { useSettings } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme, withAlpha, type ColorTokens } from '@/theme';

// Jornada inteira cadastrada à mão (R11): data + turnos. Horários que "voltam" viram o dia seguinte.

type Shift = { start: MinuteOfDay; end: MinuteOfDay };

export function NewWorkday({ initialDate }: { initialDate?: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { workRules, optionalHolidays, splitBreak } = useSettings();
  const [date, setDate] = useState(() => initialDate ?? toDateKey(Date.now()));
  const [shifts, setShifts] = useState<Shift[]>([{ start: 8 * 60, end: 12 * 60 }]);
  const [pickingDate, setPickingDate] = useState(false);
  const { data } = useDbQuery(async (d) => ({ templates: await listTemplates(d), overrides: await listHolidayOverrides(d) }), []);

  const holiday = data ? holidaysInRange(date, date, data.overrides, { includeOptional: optionalHolidays }).get(date) : null;
  const minutes = shifts.flatMap((s) => [s.start, s.end]);
  const instants = resolveSequence(fromDateKey(date).getTime(), minutes);
  const summary = summarizeWorkday(instants.map((at, i) => ({ kind: i % 2 === 0 ? ('in' as const) : ('out' as const), at })));
  const isNextDay = (i: number) => toDateKey(instants[i]) !== date;
  const limitMs = workRules.dailyLimitMinutes * MINUTE;
  const extraMs = holiday ? summary.workedMs : Math.max(0, summary.workedMs - limitMs);
  const breakIssue = checkBreak(summary, { splitBreak });

  const update = (index: number, patch: Partial<Shift>) =>
    setShifts((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  function addShift() {
    Haptics.selectionAsync().catch(() => {});
    const lastEnd = shifts.at(-1)!.end;
    setShifts((list) => [...list, { start: (lastEnd + 60) % 1440, end: (lastEnd + 180) % 1440 }]);
  }

  function removeShift(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShifts((list) => list.filter((_, j) => j !== index));
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
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`Dia: ${formatLongDay(date)}. Tocar para mudar.`}
        onPress={() => setPickingDate(true)}
      >
        <Card style={styles.dateCard}>
          <View style={[styles.dateIcon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
            <Icon name="calendar_today" color="primary" />
          </View>
          <View style={styles.flex}>
            <Text variant="micro" color="textMuted">
              Dia da jornada
            </Text>
            <Text variant="headline">{formatLongDay(date)}</Text>
          </View>
          <Text variant="caption" color="primary">
            Mudar
          </Text>
        </Card>
      </PressableScale>

      {holiday ? <StatusPill status="holiday" label={`Feriado · ${holiday.name} · horas contam 100%`} /> : null}

      {data && data.templates.length > 0 ? (
        <View style={styles.section}>
          <Text variant="micro" color="textMuted">
            Preencher com uma escala
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.templateRow}>
            {data.templates.map((t) => (
              <Button key={t.id} label={t.name} icon="view_timeline" variant="secondary" size="sm" onPress={() => setShifts(t.shifts)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="micro" color="textMuted">
          Turnos
        </Text>
        {shifts.map((shift, i) => {
          const start = instants[i * 2];
          const end = instants[i * 2 + 1];
          const breakBefore = i > 0 ? start - instants[i * 2 - 1] : null;
          return (
            <View key={i} style={styles.section}>
              {breakBefore !== null ? <BreakConnector ms={breakBefore} /> : null}
              <Card style={styles.shift}>
                <View style={styles.shiftHeader}>
                  <View style={[styles.shiftBadge, { backgroundColor: withAlpha(colors.work, 0.14) }]}>
                    <Text variant="caption" color="work">
                      {i + 1}º turno
                    </Text>
                  </View>
                  <Text variant="body" color="textMuted" tabular style={styles.flex}>
                    {formatDuration(end - start)}
                  </Text>
                  {shifts.length > 1 ? (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${i + 1}º turno`}
                      onPress={() => removeShift(i)}
                      hitSlop={6}
                      style={styles.removeButton}
                    >
                      <Icon name="delete" size={20} color="textMuted" />
                    </PressableScale>
                  ) : null}
                </View>
                <View style={styles.times}>
                  <TimeField label="Entrada" accent="work" value={shift.start} onChange={(v) => update(i, { start: v })} nextDay={isNextDay(i * 2)} />
                  <Icon name="arrow_forward" size={20} color="textMuted" />
                  <TimeField label="Saída" accent="break" value={shift.end} onChange={(v) => update(i, { end: v })} nextDay={isNextDay(i * 2 + 1)} />
                </View>
              </Card>
            </View>
          );
        })}

        <PressableScale
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel="Adicionar turno"
          onPress={addShift}
          style={[styles.addShift, { borderColor: colors.border }]}
        >
          <Icon name="add" size={20} color="primary" />
          <Text variant="headline" color="primary">
            Adicionar turno
          </Text>
        </PressableScale>
      </View>

      <Card style={styles.summary}>
        <Total label="Trabalhado" value={formatDuration(summary.workedMs)} color="work" />
        <View style={[styles.vr, { backgroundColor: colors.border }]} />
        <Total label="Intervalo" value={formatDuration(summary.breakMs)} color="break" />
        <View style={[styles.vr, { backgroundColor: colors.border }]} />
        <Total label={holiday ? 'Extra 100%' : 'Além do limite'} value={extraMs >= MINUTE ? formatDuration(extraMs) : '—'} color={extraMs >= MINUTE ? 'extra' : 'textMuted'} />
      </Card>
      {breakIssue ? (
        <Text variant="caption" color="break" align="center">
          {describeBreakIssue(breakIssue, formatDuration)}
        </Text>
      ) : null}

      <Button label="Salvar jornada" icon="check" size="lg" block onPress={save} />

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

function BreakConnector({ ms }: { ms: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.connector}>
      <View style={[styles.connectorLine, { borderColor: colors.break }]} />
      <View style={[styles.connectorTag, { backgroundColor: colors.bg, borderColor: withAlpha(colors.break, 0.5) }]}>
        <Icon name="coffee" size={20} color="break" />
        <Text variant="caption" color="break" tabular>
          Intervalo de {formatDuration(ms)}
        </Text>
      </View>
    </View>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: keyof ColorTokens }) {
  return (
    <View style={styles.total}>
      <Text variant="headline" color={color} tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" color="textMuted" align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  bleed: { marginHorizontal: -spacing.gutter, flexGrow: 0 },
  templateRow: { paddingHorizontal: spacing.gutter, gap: spacing.sm },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  dateIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  shift: { gap: spacing.md },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  shiftBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  removeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  times: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  connector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 36 },
  connectorLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeftWidth: 2, borderStyle: 'dashed' },
  connectorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  addShift: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouch + 4,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  vr: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
