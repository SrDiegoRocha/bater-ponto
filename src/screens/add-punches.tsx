import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { TimeField } from '@/components/time/time-field';
import { Button, ChoiceChips, Icon, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { toDateKey } from '@/domain/time';
import { minuteOfDay, nextOccurrence, type MinuteOfDay } from '@/domain/time-of-day';
import type { PunchKind } from '@/domain/types';
import { getWorkday } from '@/db/workday-repo';
import { formatShortDate, formatTime } from '@/lib/format';
import { addPunchesToWorkday } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { spacing } from '@/theme';

import { SheetContainer } from './sheet-container';

// Adicionar turno esquecido ou uma batida avulsa (ex.: faltou a volta do intervalo) — §3.11.

type Mode = 'shift' | 'single';

export function AddPunches({ workdayId }: { workdayId: string }) {
  const db = useSQLiteContext();
  const { data: workday } = useDbQuery((d) => getWorkday(d, workdayId), [workdayId]);
  const [mode, setMode] = useState<Mode>('shift');
  const [kind, setKind] = useState<PunchKind>('in');
  const [start, setStart] = useState<MinuteOfDay | null>(null);
  const [end, setEnd] = useState<MinuteOfDay | null>(null);
  const [now] = useState(() => Date.now());

  if (!workday) return <SheetContainer />;

  const anchor = workday.punches[0]?.at ?? now;
  const last = workday.punches.at(-1);
  const defaultStart = minuteOfDay((last?.at ?? anchor) + 60 * 60_000);
  const s = start ?? defaultStart;
  const e = end ?? (s + 60) % 1440;

  // Horários são resolvidos a partir do início da jornada (cobrem a madrugada seguinte)
  const startAt = nextOccurrence(anchor, s, { inclusive: true });
  const endAt = nextOccurrence(startAt, e);
  const refDate = workday.refDate;

  async function save() {
    try {
      const added =
        mode === 'shift'
          ? [
              { kind: 'in' as const, at: startAt },
              { kind: 'out' as const, at: endAt },
            ]
          : [{ kind, at: startAt }];
      const undo = await addPunchesToWorkday(db, workdayId, added);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(mode === 'shift' ? `Turno ${formatTime(startAt)} → ${formatTime(endAt)} adicionado` : 'Batida adicionada', {
        actions: [{ label: 'Desfazer', onPress: () => undo() }],
      });
    } catch (err) {
      Alert.alert('Não foi possível adicionar', (err as Error).message);
    }
  }

  return (
    <SheetContainer>
      <Text variant="title2">Adicionar à jornada de {formatShortDate(refDate)}</Text>
      <ChoiceChips
        options={[
          { value: 'shift', label: 'Turno completo', icon: 'more_time' },
          { value: 'single', label: 'Só uma batida', icon: 'touch_app' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'single' ? (
        <ChoiceChips
          options={[
            { value: 'in', label: 'Entrada', color: 'work' },
            { value: 'out', label: 'Saída', color: 'break' },
          ]}
          value={kind}
          onChange={setKind}
        />
      ) : null}
      <View style={styles.times}>
        <TimeField
          label={mode === 'shift' ? 'Entrada' : kind === 'in' ? 'Entrada' : 'Saída'}
          accent={mode === 'single' && kind === 'out' ? 'break' : 'work'}
          value={s}
          onChange={setStart}
          nextDay={toDateKey(startAt) !== refDate}
        />
        {mode === 'shift' ? (
          <>
            <Icon name="arrow_forward" size={20} color="textMuted" />
            <TimeField label="Saída" accent="break" value={e} onChange={setEnd} nextDay={toDateKey(endAt) !== refDate} />
          </>
        ) : null}
      </View>
      <Button label="Adicionar" size="lg" block onPress={save} />
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  times: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
