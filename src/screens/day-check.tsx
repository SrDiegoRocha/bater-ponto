import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { EMPTY_TIME, TimeTyper } from '@/components/time/time-typer';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { MINUTE } from '@/domain/time';
import { parseTypedTime } from '@/domain/time-of-day';
import { DAY_DIFF_TOLERANCE_MS, type DayCheck } from '@/domain/timesheet-check';
import type { DateKey } from '@/domain/types';
import { summarizeWorkday } from '@/domain/workday';
import { deleteDayCheck, getDayCheck, saveDayChecks } from '@/db/day-check-repo';
import { listWorkdays, type WorkdayWithPunches } from '@/db/workday-repo';
import { formatDuration, formatLongDay, formatTime } from '@/lib/format';
import { bumpData } from '@/stores/data-store';
import { fonts, radius, spacing, useTheme } from '@/theme';

// Um dia da conferência do espelho: o que foi anotado aqui × o que o espelho da empresa mostra.

const pad = (n: number) => String(n).padStart(2, '0');
const toDigits = (ms: number | null) => {
  if (ms === null) return EMPTY_TIME;
  const minutes = Math.round(ms / MINUTE);
  return `${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}`;
};

export function DayCheckScreen({ date }: { date: DateKey }) {
  const { data } = useDbQuery(
    async (d) => ({ check: await getDayCheck(d, date), workdays: await listWorkdays(d, date, date) }),
    [date],
  );
  // Espera o que já foi salvo para preencher o formulário uma vez só
  if (!data) return <Screen nativeHeader />;
  return <DayCheckForm date={date} saved={data.check} workdays={data.workdays} />;
}

function DayCheckForm({ date, saved, workdays }: { date: DateKey; saved: DayCheck | null; workdays: WorkdayWithPunches[] }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const now = useNow();
  const [digits, setDigits] = useState(() => toDigits(saved?.companyWorkedMs ?? null));
  const [note, setNote] = useState(saved?.note ?? '');

  const summaries = workdays.map((w) => ({ w, s: summarizeWorkday(w.punches, now) }));
  const workedMs = summaries.reduce((sum, { s }) => sum + s.workedMs, 0);
  const incomplete = summaries.some(({ w, s }) => w.status === 'incomplete' || !s.isConsistent);

  const companyMinutes = parseTypedTime(digits);
  const companyMs = companyMinutes !== null ? companyMinutes * MINUTE : null;
  const diffMs = companyMs !== null ? companyMs - workedMs : null;
  const invalid = !digits.includes(' ') && companyMinutes === null;

  async function save(check: Omit<DayCheck, 'date'> | null) {
    if (check) await saveDayChecks(db, [{ date, ...check }]);
    else await deleteDayCheck(db, date);
    bumpData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }

  const saveDiff = () => save({ status: 'diff', companyWorkedMs: companyMs, note: note.trim() || null });
  const saveOk = () => save({ status: 'ok', companyWorkedMs: null, note: null });

  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      <Text variant="title2">{formatLongDay(date)}</Text>

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          O que você anotou
        </Text>
        {workdays.length === 0 ? (
          <Text variant="body" color="textMuted">
            Nenhuma batida anotada neste dia.
          </Text>
        ) : (
          summaries.map(({ w }) => (
            <Text key={w.id} variant="headline" tabular>
              {w.punches.map((p) => formatTime(p.at)).join(' · ')}
            </Text>
          ))
        )}
        {workdays.length > 0 ? (
          <Text variant="body" color={incomplete ? 'danger' : 'textMuted'} tabular>
            {incomplete ? 'Jornada incompleta: falta alguma batida' : `Trabalhado ${formatDuration(workedMs)}`}
          </Text>
        ) : null}
        <Button
          label={workdays.length ? 'Corrigir minhas batidas' : 'Anotar este dia'}
          icon="edit"
          variant="ghost"
          size="sm"
          onPress={() =>
            workdays.length
              ? router.push(`/jornada/${workdays[0].id}`)
              : router.push({ pathname: '/jornada/nova', params: { date } })
          }
        />
      </Card>

      {incomplete ? (
        <Banner
          tone="warning"
          icon="warning"
          title="Corrija suas batidas primeiro"
          description="Com a jornada incompleta, as horas anotadas não servem de comparação."
        />
      ) : null}

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Horas trabalhadas no espelho da empresa
        </Text>
        <TimeTyper value={digits} onChange={setDigits} invalid={invalid} autoFocus={false} />
        <Text
          variant="body"
          align="center"
          tabular
          color={diffMs === null ? 'textMuted' : Math.abs(diffMs) < DAY_DIFF_TOLERANCE_MS ? 'work' : 'danger'}
        >
          {invalid
            ? 'Horas inválidas'
            : diffMs === null
              ? 'Ex.: 0750 = 7h50 (opcional)'
              : Math.abs(diffMs) < DAY_DIFF_TOLERANCE_MS
                ? 'Igual ao que você anotou'
                : `Espelho com ${formatDuration(Math.abs(diffMs))} a ${diffMs < 0 ? 'menos' : 'mais'}`}
        </Text>
      </Card>

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          O que está diferente?
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Ex.: saída das 17:05 aparece 17:00; falta a volta do almoço"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          multiline
          style={[styles.note, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}
        />
      </Card>

      <Button label="Salvar como diferente" icon="error" size="lg" block disabled={invalid} onPress={saveDiff} />
      <Button label="Na verdade bate" icon="check" variant="secondary" block onPress={saveOk} />
      {saved ? <Button label="Limpar conferência do dia" variant="ghost" onPress={() => save(null)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  note: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});

