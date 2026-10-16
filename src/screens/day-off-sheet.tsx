import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { dayOffColor, dayOffLabel } from '@/components/calendar/calendar-grid';
import { Button, Card, ChoiceChips, StatusPill, SwitchRow, Text, type Choice } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { holidaysInRange } from '@/domain/holidays';
import type { DateKey, DayOffKind } from '@/domain/types';
import { listDayOffs } from '@/db/day-off-repo';
import { listHolidayOverrides, renameCustomHoliday } from '@/db/holiday-repo';
import { toDateKey } from '@/domain/time';
import { formatLongDay, formatShortDate, formatTime } from '@/lib/format';
import { setHolidayOnDates } from '@/services/holiday-service';
import { clearDayOffs, copyWorkdayToDates, findLastCompleteWorkday, findWorkdaysOnDates, setDayOffs } from '@/services/punch-service';
import { bumpData } from '@/stores/data-store';
import { useSettings } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { SheetContainer } from './sheet-container';

// Ficha do dia no calendário (PLANEJAMENTO.md §3.3), para uma ou várias datas:
// feriado (propriedade do dia, aceita jornada), registrar o que foi trabalhado ou marcar folga/férias/atestado.

type OffKind = Exclude<DayOffKind, 'feriado'>;

const kinds: Choice<OffKind>[] = (['folga', 'ferias', 'atestado'] as const).map((k) => ({
  value: k,
  label: dayOffLabel[k],
  color: dayOffColor[k],
  icon: ({ folga: 'beach_access', ferias: 'flight', atestado: 'medical_services' } as const)[k],
}));

export function DayOffSheet({ dates }: { dates: DateKey[] }) {
  const db = useSQLiteContext();
  const { optionalHolidays } = useSettings();
  const sorted = [...dates].sort();
  const { data } = useDbQuery(
    async (d) => ({
      dayOffs: await listDayOffs(d, sorted[0], sorted.at(-1)!),
      workdays: await findWorkdaysOnDates(d, dates),
      overrides: await listHolidayOverrides(d),
      lastComplete: dates.length === 1 ? await findLastCompleteWorkday(d, dates[0]) : null,
    }),
    [dates.join(',')],
  );
  const [kind, setKind] = useState<OffKind | null>(null);
  const [today] = useState(() => toDateKey(Date.now()));

  if (!data) return <SheetContainer />;

  const existing = data.dayOffs.filter((d) => dates.includes(d.date));
  const single = dates.length === 1 ? dates[0] : null;
  const holidays = holidaysInRange(sorted[0], sorted.at(-1)!, data.overrides, { includeOptional: optionalHolidays });
  const allHoliday = dates.every((d) => holidays.has(d));
  const holiday = single ? holidays.get(single) : null;
  const existingKind = existing[0]?.kind;
  const selected: OffKind = kind ?? (existingKind && existingKind !== 'feriado' ? existingKind : 'folga');
  const canWork = single !== null && single <= today && data.workdays.length === 0;

  async function toggleHoliday(on: boolean) {
    const undo = await setHolidayOnDates(db, dates, on, { includeOptional: optionalHolidays });
    Haptics.selectionAsync().catch(() => {});
    showToast(on ? (single ? 'Dia marcado como feriado' : `${dates.length} dias marcados como feriado`) : 'Feriado removido', {
      actions: [{ label: 'Desfazer', onPress: () => undo() }],
    });
  }

  async function save(replaceWorkdays = false) {
    if (data!.workdays.length && !replaceWorkdays) {
      // F2: jornada nesse dia → confirmar substituição
      Alert.alert(
        'Já existe jornada nesse dia',
        data!.workdays.length === 1
          ? `Excluir a jornada e marcar como ${dayOffLabel[selected].toLowerCase()}?`
          : `Excluir ${data!.workdays.length} jornadas e marcar como ${dayOffLabel[selected].toLowerCase()}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir e marcar', style: 'destructive', onPress: () => save(true) },
        ],
      );
      return;
    }
    const undo = await setDayOffs(db, dates, selected, { replaceWorkdays });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
    showToast(single ? `${dayOffLabel[selected]} marcada` : `${dates.length} dias marcados como ${dayOffLabel[selected].toLowerCase()}`, {
      actions: [{ label: 'Desfazer', onPress: () => undo() }],
    });
  }

  async function copyLast() {
    const source = data!.lastComplete!;
    const { created, skipped, undo } = await copyWorkdayToDates(db, source.id, [single!]);
    if (created.length === 0) {
      Alert.alert('Não foi possível copiar', skipped[0]?.reason ?? '');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
    showToast(`Jornada de ${formatShortDate(source.refDate)} copiada`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
  }

  async function remove() {
    const undo = await clearDayOffs(db, dates);
    router.back();
    showToast(`${existingKind ? dayOffLabel[existingKind] : 'Folga'} removida`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
  }

  return (
    <SheetContainer>
      <View style={styles.header}>
        <Text variant="title2">{single ? formatLongDay(single) : `${dates.length} dias selecionados`}</Text>
        <View style={styles.pills}>
          {holiday ? <StatusPill status="holiday" label={holiday.name} /> : null}
          {existingKind && existingKind !== 'feriado' ? (
            <StatusPill status={existingKind === 'folga' ? 'dayOff' : existingKind === 'ferias' ? 'vacation' : 'sickLeave'} />
          ) : null}
          {data.workdays.length > 0 ? <StatusPill status="work" label={data.workdays.length === 1 ? 'Com jornada' : `${data.workdays.length} jornadas`} /> : null}
        </View>
      </View>

      <Card style={styles.holidayCard}>
        <SwitchRow
          title={single ? 'Feriado neste dia' : 'Feriado nesses dias'}
          subtitle="Municipal, estadual ou ponto facultativo. Se trabalhar, as horas contam como extra 100%."
          value={allHoliday}
          onValueChange={toggleHoliday}
        />
        {holiday && holiday.kind === 'custom' ? (
          <HolidayName key={holiday.key} id={holiday.key.slice('custom:'.length)} name={holiday.name} />
        ) : null}
      </Card>

      {data.workdays.length === 1 && single ? (
        <Button
          label="Ver jornada deste dia"
          icon="visibility"
          variant="secondary"
          block
          onPress={() => router.replace(`/jornada/${data.workdays[0].id}`)}
        />
      ) : null}

      {canWork ? (
        <View style={styles.section}>
          <Text variant="micro" color="textMuted">
            {holiday ? 'Trabalhou no feriado?' : 'Trabalhou nesse dia?'}
          </Text>
          <Button
            label="Registrar jornada"
            icon="add"
            block
            onPress={() => router.replace({ pathname: '/jornada/nova', params: { date: single } })}
          />
          {data.lastComplete ? (
            <Button
              label={`Copiar ${formatShortDate(data.lastComplete.refDate)} · ${formatTime(data.lastComplete.punches[0].at)}–${formatTime(data.lastComplete.punches.at(-1)!.at)}`}
              variant="secondary"
              icon="content_copy"
              block
              onPress={copyLast}
            />
          ) : null}
          <Button
            label="Aplicar escala"
            variant="ghost"
            icon="edit_calendar"
            onPress={() => router.replace({ pathname: '/aplicar', params: { dates: single } })}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="micro" color="textMuted">
          {single ? 'Não trabalhou?' : 'Marcar como'}
        </Text>
        <ChoiceChips options={kinds} value={selected} onChange={setKind} />
        {data.workdays.length > 0 ? (
          <Text variant="caption" color="break">
            {data.workdays.length === 1 ? 'Há uma jornada nesse dia: ela será excluída.' : `Há ${data.workdays.length} jornadas nesses dias: serão excluídas.`}
          </Text>
        ) : null}
        <Button label={`Marcar ${dayOffLabel[selected].toLowerCase()}`} variant={canWork ? 'secondary' : 'primary'} block onPress={() => save()} />
        {existing.length > 0 ? (
          <Button label={`Remover ${existingKind ? dayOffLabel[existingKind].toLowerCase() : 'folga'}`} variant="destructive" icon="delete" onPress={remove} />
        ) : null}
      </View>
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  holidayCard: { paddingVertical: spacing.sm, gap: spacing.sm },
  nameField: { gap: spacing.xs, paddingBottom: spacing.sm },
  nameInput: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  section: { gap: spacing.sm },
});

/** Nome do feriado próprio, editável ali mesmo (ex.: "Aniversário de Goiânia") */
function HolidayName({ id, name }: { id: string; name: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [text, setText] = useState(name);

  async function commit() {
    const next = text.trim();
    if (!next || next === name) return setText(name);
    await renameCustomHoliday(db, id, next);
    bumpData();
  }

  return (
    <View style={styles.nameField}>
      <Text variant="caption" color="textMuted">
        Nome do feriado
      </Text>
      <TextInput
        accessibilityLabel="Nome do feriado"
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
        maxLength={40}
        placeholder="Ex.: Aniversário da cidade"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}
      />
    </View>
  );
}
