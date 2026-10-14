import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { TimeAdjuster } from '@/components/time/time-adjuster';
import { Button, ChoiceChips, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { actionsByState, deriveDayState, type DayAction } from '@/domain/state-machine';
import { formatTime } from '@/lib/format';
import { getOpenWorkday } from '@/db/workday-repo';
import { getActionBounds, performDayAction } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';

import { SheetContainer } from './sheet-container';

// Bater o ponto com outro horário (R8): toque longo no botão principal.

const labels: Record<DayAction, string> = {
  startDay: 'Iniciar dia',
  pause: 'Pausar',
  resume: 'Voltar ao trabalho',
  endDay: 'Encerrar dia',
};

export function RetroPunch({ initialAction }: { initialAction?: DayAction }) {
  const db = useSQLiteContext();
  const [now] = useState(() => Date.now());
  const { data } = useDbQuery(async (d) => {
    const open = await getOpenWorkday(d);
    return { state: deriveDayState(open?.punches ?? null), bounds: await getActionBounds(d, now) };
  }, []);
  const [value, setValue] = useState(now);
  const [chosen, setChosen] = useState<DayAction | null>(initialAction ?? null);

  if (!data) return <SheetContainer />;

  const { primary, secondary } = actionsByState[data.state];
  const options = [primary, ...(secondary ? [secondary] : [])];
  const action = chosen && options.includes(chosen) ? chosen : primary;
  // Encerrar no intervalo usa a última saída: não precisa de horário
  const needsTime = !(data.state === 'break' && action === 'endDay');

  async function confirm() {
    try {
      const result = await performDayAction(db, action, { at: value, source: 'retro' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(`${labels[action]} · ${formatTime(needsTime ? value : Date.now())}`, {
        actions: [{ label: 'Desfazer', onPress: () => result.undo() }],
      });
    } catch (e) {
      Alert.alert('Não foi possível bater o ponto', (e as Error).message);
    }
  }

  return (
    <SheetContainer>
      <Text variant="title2">Bater com outro horário</Text>
      {options.length > 1 ? (
        <ChoiceChips
          options={options.map((o) => ({ value: o, label: labels[o], icon: o === 'endDay' ? 'stop' : o === 'pause' ? 'pause' : 'play_arrow' }))}
          value={action}
          onChange={setChosen}
        />
      ) : null}
      {needsTime ? (
        <TimeAdjuster initialValue={now} bounds={data.bounds} onChange={setValue} />
      ) : (
        <Text variant="body" color="textMuted">
          O fim do dia será a sua última pausa.
        </Text>
      )}
      <Button label={labels[action]} size="lg" block onPress={confirm} />
    </SheetContainer>
  );
}
