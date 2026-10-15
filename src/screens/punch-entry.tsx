import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { TimeTyper } from '@/components/time/time-typer';
import { Button, ChoiceChips, Screen, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { actionsByState, deriveDayState, type DayAction } from '@/domain/state-machine';
import { toDateKey } from '@/domain/time';
import { lastOccurrence, minuteOfDay, parseTypedTime } from '@/domain/time-of-day';
import { FUTURE_TOLERANCE_MS } from '@/domain/validation';
import { getOpenWorkday } from '@/db/workday-repo';
import { formatShortDate, formatTime } from '@/lib/format';
import { getActionBounds, performDayAction } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { spacing } from '@/theme';

// Anotar uma batida feita no app de ponto da empresa: escolhe o tipo e digita o horário que ele mostra.
// O app não é o relógio oficial; serve para conferir se as horas (e o salário) batem.

const labels: Record<DayAction, string> = {
  startDay: 'Entrada',
  pause: 'Saída para intervalo',
  resume: 'Volta do intervalo',
  endDay: 'Saída final',
};

const toastLabels: Record<DayAction, string> = {
  startDay: 'Entrada anotada',
  pause: 'Saída para intervalo anotada',
  resume: 'Volta do intervalo anotada',
  endDay: 'Saída final anotada',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function PunchEntry({ initialAction }: { initialAction?: DayAction }) {
  const db = useSQLiteContext();
  const [openedAt] = useState(() => Date.now());
  const now = useNow();
  const { data } = useDbQuery(async (d) => {
    const open = await getOpenWorkday(d);
    return { open, bounds: await getActionBounds(d, openedAt) };
  }, []);
  const [digits, setDigits] = useState('');
  const [chosen, setChosen] = useState<DayAction | null>(initialAction ?? null);

  if (!data) return <Screen nativeHeader />;

  const punches = data.open?.punches ?? null;
  const state = deriveDayState(punches);
  const { primary, secondary } = actionsByState[state];
  const options = [primary, ...(secondary ? [secondary] : [])];
  // Depois de um intervalo, a próxima saída costuma ser a final
  const suggested = state === 'working' && (punches?.length ?? 0) >= 3 ? 'endDay' : primary;
  const action = chosen && options.includes(chosen) ? chosen : suggested;
  // Encerrar durante o intervalo: a última saída vira o fim do dia, sem horário novo
  const needsTime = !(state === 'break' && action === 'endDay');

  const minutes = parseTypedTime(digits);
  const at = minutes !== null ? lastOccurrence(now, minutes, FUTURE_TOLERANCE_MS) : null;
  const lastAt = punches?.at(-1)?.at ?? null;
  let problem: string | null = null;
  if (digits.length === 4 && minutes === null) problem = 'Horário inválido.';
  // Futuro não acontece: lastOccurrence sempre volta para o passado
  else if (at !== null && data.bounds.min !== null && at < data.bounds.min) {
    problem =
      lastAt !== null
        ? `Precisa ser depois da última batida (${formatTime(lastAt)}).`
        : 'Precisa ser depois do fim da jornada anterior.';
  }
  const notToday = at !== null && toDateKey(at) !== toDateKey(now);
  const canSave = !needsTime || (at !== null && problem === null);

  function fillNow() {
    const m = minuteOfDay(now);
    setDigits(`${pad(Math.floor(m / 60))}${pad(m % 60)}`);
  }

  async function save() {
    try {
      const result = await performDayAction(db, action, needsTime ? { at: at!, source: 'retro' } : undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(needsTime ? `${toastLabels[action]} · ${formatTime(at!)}` : 'Dia encerrado na última saída', {
        actions: [{ label: 'Desfazer', onPress: () => result.undo() }],
      });
    } catch (e) {
      Alert.alert('Não foi possível anotar', (e as Error).message);
    }
  }

  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      {options.length > 1 ? (
        <ChoiceChips
          options={options.map((o) => ({
            value: o,
            label: o === 'endDay' && state === 'break' ? 'Encerrar o dia' : labels[o],
            icon: o === 'endDay' ? 'stop' : o === 'pause' ? 'pause' : 'play_arrow',
          }))}
          value={action}
          onChange={setChosen}
        />
      ) : (
        <Text variant="headline">{labels[action]}</Text>
      )}

      {needsTime ? (
        <View style={styles.gap}>
          <Text variant="body" color="textMuted">
            Digite o horário que aparece no app da empresa
          </Text>
          <TimeTyper digits={digits} onChangeDigits={setDigits} invalid={problem !== null} />
          {problem ? (
            <Text variant="caption" color="danger" align="center">
              {problem}
            </Text>
          ) : notToday && at !== null ? (
            <Text variant="caption" color="break" align="center">
              Vai ficar em {formatShortDate(at)} (ontem)
            </Text>
          ) : null}
          <Button label="Usar o horário de agora" icon="schedule" variant="ghost" size="sm" onPress={fillNow} />
        </View>
      ) : (
        <Text variant="body" color="textMuted">
          A sua última saída ({lastAt !== null ? formatTime(lastAt) : '—'}) vira o fim do dia.
        </Text>
      )}

      <Button label="Anotar" size="lg" block disabled={!canSave} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
});
