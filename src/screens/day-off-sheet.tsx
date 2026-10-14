import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { dayOffColor, dayOffLabel } from '@/components/calendar/calendar-grid';
import { Button, ChoiceChips, StatusPill, Text, type Choice } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { holidaysInRange } from '@/domain/holidays';
import type { DateKey, DayOffKind } from '@/domain/types';
import { listDayOffs } from '@/db/day-off-repo';
import { listHolidayOverrides } from '@/db/holiday-repo';
import { toDateKey } from '@/domain/time';
import { formatShortDate, formatTime } from '@/lib/format';
import { clearDayOffs, copyWorkdayToDates, findLastCompleteWorkday, findWorkdaysOnDates, setDayOffs } from '@/services/punch-service';
import { useSettings } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { spacing } from '@/theme';

import { SheetContainer } from './sheet-container';

// Marcar folga em uma ou várias datas (PLANEJAMENTO.md §3.3). Também é a "ficha do dia" no calendário.

const kinds: Choice<DayOffKind>[] = (['folga', 'ferias', 'atestado', 'feriado'] as const).map((k) => ({
  value: k,
  label: dayOffLabel[k],
  color: dayOffColor[k],
  icon: ({ folga: 'beach_access', ferias: 'flight', atestado: 'medical_services', feriado: 'celebration' } as const)[k],
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
  const [kind, setKind] = useState<DayOffKind | null>(null);
  const [today] = useState(() => toDateKey(Date.now()));

  if (!data) return <SheetContainer />;

  const existing = data.dayOffs.filter((d) => dates.includes(d.date));
  const single = dates.length === 1 ? dates[0] : null;
  const holiday = single ? holidaysInRange(single, single, data.overrides, { includeOptional: optionalHolidays }).get(single) : null;
  const selected = kind ?? existing[0]?.kind ?? 'folga';
  const title = single ? formatShortDate(single) : `${dates.length} dias selecionados`;

  async function save(replaceWorkdays = false) {
    if (data!.workdays.length && !replaceWorkdays) {
      // F2: jornada nesse dia → confirmar substituição
      Alert.alert(
        'Já existe jornada nesse dia',
        data!.workdays.length === 1
          ? 'Excluir a jornada e marcar como folga?'
          : `Excluir ${data!.workdays.length} jornadas e marcar como folga?`,
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
    showToast('Folga removida', { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
  }

  return (
    <SheetContainer>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title2">{title}</Text>
        {holiday ? <StatusPill status="holiday" label={`Feriado · ${holiday.name}`} /> : null}
      </View>

      <Text variant="micro" color="textMuted">
        Marcar como
      </Text>
      <ChoiceChips options={kinds} value={selected} onChange={setKind} />

      {data.workdays.length > 0 ? (
        <Text variant="caption" color="break">
          {data.workdays.length === 1 ? 'Há uma jornada nesse dia.' : `Há ${data.workdays.length} jornadas nesses dias.`}
        </Text>
      ) : null}

      <Button label="Salvar" size="lg" block onPress={() => save()} />
      {existing.length > 0 ? <Button label="Remover folga" variant="destructive" icon="delete" onPress={remove} /> : null}
      {single && data.lastComplete && data.workdays.length === 0 && existing.length === 0 && single <= today ? (
        <Button
          label={`Copiar jornada de ${formatShortDate(data.lastComplete.refDate)} (${formatTime(data.lastComplete.punches[0].at)} → ${formatTime(data.lastComplete.punches.at(-1)!.at)})`}
          variant="secondary"
          icon="content_copy"
          block
          onPress={copyLast}
        />
      ) : null}
      {single && data.workdays.length === 0 && existing.length === 0 ? (
        <Button
          label="Registrar jornada nesse dia"
          variant="ghost"
          icon="add"
          onPress={() => router.replace({ pathname: '/jornada/nova', params: { date: single } })}
        />
      ) : null}
    </SheetContainer>
  );
}
