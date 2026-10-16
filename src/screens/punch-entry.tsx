import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EMPTY_TIME, TimeTyper } from '@/components/time/time-typer';
import { Button, Card, Icon, Screen, Text, type IconName } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { punchLabel } from '@/components/workday/timeline';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { actionsByState, deriveDayState, type DayAction } from '@/domain/state-machine';
import { toDateKey } from '@/domain/time';
import { lastOccurrence, minuteOfDay, parseTypedTime } from '@/domain/time-of-day';
import { FUTURE_TOLERANCE_MS } from '@/domain/validation';
import { getOpenWorkday } from '@/db/workday-repo';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { getActionBounds, performDayAction } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { radius, spacing, useTheme, withAlpha, type ColorTokens } from '@/theme';

// Anotar uma batida feita no app de ponto da empresa: escolhe o tipo e digita o horário que ele mostra.
// O app não é o relógio oficial; serve para conferir se as horas (e o salário) batem.

type ActionInfo = { title: string; description: string; icon: IconName; color: keyof ColorTokens };

const actionInfo: Record<DayAction, ActionInfo> = {
  startDay: { title: 'Entrada', description: 'Começo da jornada', icon: 'login', color: 'work' },
  pause: { title: 'Saída para intervalo', description: 'Almoço, descanso… você vai voltar depois', icon: 'coffee', color: 'break' },
  resume: { title: 'Volta do intervalo', description: 'Voltou a trabalhar', icon: 'play_arrow', color: 'work' },
  endDay: { title: 'Saída final', description: 'Encerra a jornada de hoje', icon: 'logout', color: 'text' },
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
  const [digits, setDigits] = useState(EMPTY_TIME);
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

  const complete = !digits.includes(' ');
  const minutes = parseTypedTime(digits);
  const at = minutes !== null ? lastOccurrence(now, minutes, FUTURE_TOLERANCE_MS) : null;
  const last = punches?.at(-1) ?? null;
  let problem: string | null = null;
  if (complete && minutes === null) problem = 'Horário inválido.';
  // Futuro não acontece: lastOccurrence sempre volta para o passado
  else if (at !== null && data.bounds.min !== null && at < data.bounds.min) {
    problem =
      last !== null
        ? `Precisa ser depois da última batida (${formatTime(last.at)}).`
        : 'Precisa ser depois do fim da jornada anterior.';
  }
  const notToday = at !== null && toDateKey(at) !== toDateKey(now);
  const canSave = !needsTime || (at !== null && problem === null);

  // O que a batida fecha: um turno (saídas) ou um intervalo (volta)
  let effect: string | null = null;
  if (at !== null && problem === null && last) {
    const gap = formatDuration(at - last.at);
    if (action === 'pause' || action === 'endDay') effect = `Fecha um turno de ${gap} trabalhadas`;
    else if (action === 'resume') effect = `Intervalo de ${gap}`;
  }

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

  const info = actionInfo[action];
  const saveLabel = !needsTime ? 'Encerrar o dia' : at !== null && problem === null ? `Anotar ${info.title.toLowerCase()} · ${formatTime(at)}` : `Anotar ${info.title.toLowerCase()}`;

  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      <Card style={styles.context}>
        <Icon name={state === 'off' ? 'bedtime' : state === 'working' ? 'work' : 'coffee'} size={20} color={state === 'break' ? 'break' : state === 'working' ? 'work' : 'textMuted'} />
        <Text variant="body" color="textMuted" style={styles.flex}>
          {last ? (
            <>
              Última batida: <Text variant="body">{punchLabel(last)}</Text> às{' '}
              <Text variant="headline" tabular>
                {formatTime(last.at)}
              </Text>
            </>
          ) : (
            'Nenhuma jornada aberta. Esta batida começa uma nova.'
          )}
        </Text>
      </Card>

      <View style={styles.section}>
        <Text variant="micro" color="textMuted">
          {options.length > 1 ? 'O que você vai anotar?' : 'Você vai anotar'}
        </Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {options.map((o) => {
            const item =
              o === 'endDay' && state === 'break'
                ? { ...actionInfo.endDay, title: 'Encerrar o dia', description: `Não vai voltar: a saída das ${last ? formatTime(last.at) : '—'} vira a saída final` }
                : actionInfo[o];
            return (
              <ActionOption key={o} info={item} selected={o === action} single={options.length === 1} onPress={() => setChosen(o)} />
            );
          })}
        </View>
      </View>

      {needsTime ? (
        <View style={styles.section}>
          <Text variant="micro" color="textMuted">
            Horário que aparece no app da empresa
          </Text>
          <Card style={styles.timeCard}>
            <TimeTyper value={digits} onChange={setDigits} invalid={problem !== null} />
            <View style={styles.feedback}>
              {problem ? (
                <Text variant="caption" color="danger" align="center">
                  {problem}
                </Text>
              ) : notToday && at !== null ? (
                <Text variant="caption" color="break" align="center">
                  Vai ficar em {formatShortDate(at)} (ontem)
                </Text>
              ) : effect ? (
                <Text variant="caption" color="textMuted" align="center" tabular>
                  {effect}
                </Text>
              ) : (
                <Text variant="caption" color="textMuted" align="center">
                  Toque num número para trocar só ele
                </Text>
              )}
            </View>
            <Button label={`Usar o horário de agora · ${formatTime(now)}`} icon="schedule" variant="ghost" size="sm" onPress={fillNow} />
          </Card>
        </View>
      ) : null}

      <Button label={saveLabel} size="lg" block disabled={!canSave} onPress={save} />
    </Screen>
  );
}

function ActionOption({ info, selected, single, onPress }: { info: ActionInfo; selected: boolean; single: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const accent = info.color === 'text' ? colors.primary : colors[info.color];
  return (
    <PressableScale
      scaleTo={0.98}
      disabled={single}
      onPress={() => {
        if (selected) return;
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${info.title}. ${info.description}`}
      style={[
        styles.option,
        {
          backgroundColor: selected ? withAlpha(accent, 0.1) : colors.surface,
          borderColor: selected ? accent : colors.border,
        },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <Icon name={info.icon} size={24} color={info.color === 'text' ? 'primary' : info.color} />
      </View>
      <View style={styles.flex}>
        <Text variant="headline">{info.title}</Text>
        <Text variant="caption" color="textMuted">
          {info.description}
        </Text>
      </View>
      {!single ? (
        <View style={[styles.radio, { borderColor: selected ? accent : colors.textMuted }]}>
          {selected ? <View style={[styles.radioDot, { backgroundColor: accent }]} /> : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  context: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  section: { gap: spacing.sm },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  optionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  timeCard: { gap: spacing.md, paddingVertical: spacing.xl, alignItems: 'stretch' },
  feedback: { minHeight: 18 },
});
