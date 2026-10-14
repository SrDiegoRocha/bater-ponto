import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { HOUR, MINUTE } from '@/domain/time';

// Cronômetro do dia. Só este componente re-renderiza a cada segundo (o resto da tela, a cada minuto).

type Props = {
  /** Trabalho já fechado (turnos encerrados) */
  baseMs: number;
  /** Início do turno em andamento, ou null se não está trabalhando */
  runningSince: number | null;
};

export function LiveClock({ baseMs, runningSince }: Props) {
  if (runningSince === null) return <ClockText ms={baseMs} />;
  return <RunningClock baseMs={baseMs} runningSince={runningSince} />;
}

function RunningClock({ baseMs, runningSince }: { baseMs: number; runningSince: number }) {
  const now = useNow(1000);
  return <ClockText ms={baseMs + Math.max(0, now - runningSince)} />;
}

function ClockText({ ms }: { ms: number }) {
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  const s = Math.floor((ms % MINUTE) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${h} horas e ${m} minutos trabalhados hoje`}
    >
      <Text variant="display" tabular>
        {pad(h)}:{pad(m)}
      </Text>
      <Text variant="headline" color="textMuted" tabular style={styles.seconds}>
        {pad(s)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  seconds: { marginLeft: 2, width: 24 },
});
