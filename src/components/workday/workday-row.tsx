import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Card, Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { toDateKey } from '@/domain/time';
import type { Punch, Workday } from '@/domain/types';
import type { WorkdaySummary } from '@/domain/workday';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

import { TimelineBar } from './timeline-bar';

// Linha do histórico (§5.3): toque abre o detalhe; deslizar para a esquerda revela "Excluir" (com desfazer).

type Props = {
  workday: Workday & { punches: Punch[] };
  summary: WorkdaySummary;
  onPress: () => void;
  onDelete: () => void;
};

export function WorkdayRow({ workday: w, summary: s, onPress, onDelete }: Props) {
  const { colors } = useTheme();
  const first = w.punches[0];
  const last = w.punches.at(-1);
  const crosses = last && toDateKey(last.at) !== w.refDate;
  const incomplete = w.status === 'incomplete' || !s.isConsistent;

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={56}
      overshootRight={false}
      onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
      renderRightActions={(_, __, methods) => (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Excluir jornada"
          onPress={() => {
            methods.close();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: colors.danger }]}
        >
          <Icon name="delete" color="onPrimary" />
          <Text variant="caption" color="onPrimary">
            Excluir
          </Text>
        </PressableScale>
      )}
    >
      <PressableScale scaleTo={0.98} onPress={onPress} accessibilityRole="button" accessibilityHint="Deslize para a esquerda para excluir">
        <Card style={styles.row}>
          <View style={styles.header}>
            <Text variant="headline">{formatShortDate(w.refDate)}</Text>
            <Text variant="body" tabular color={incomplete ? 'danger' : 'text'}>
              {incomplete ? 'Incompleta' : formatDuration(s.workedMs)}
            </Text>
          </View>
          <Text variant="caption" color="textMuted" tabular>
            {first ? formatTime(first.at) : '--:--'} → {w.status === 'open' ? 'agora' : last ? formatTime(last.at) : '--:--'}
            {crosses ? ' +1' : ''} · intervalo {formatDuration(s.breakMs)} · {s.segments.length}{' '}
            {s.segments.length === 1 ? 'turno' : 'turnos'}
          </Text>
          <TimelineBar refDate={w.refDate} segments={s.segments} />
        </Card>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  action: {
    width: 88,
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
