import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { toDateKey } from '@/domain/time';
import type { Punch } from '@/domain/types';
import { formatDuration, formatTime } from '@/lib/format';
import { removePunch } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { minTouch, radius, spacing, useTheme, withAlpha, type ColorTokens } from '@/theme';

// Linha do tempo vertical de uma jornada (§5.2 / §5.4).
// Editável: toque numa batida abre o editor de horário; toque longo pergunta se quer excluir.

export function punchLabel(punch: Pick<Punch, 'kind' | 'isDayStart' | 'isDayEnd'>): string {
  if (punch.isDayStart) return 'Entrada';
  if (punch.isDayEnd) return 'Saída final';
  return punch.kind === 'out' ? 'Saída para intervalo' : 'Volta do intervalo';
}

type Props = {
  punches: readonly Punch[];
  /** Agora, para o trecho em andamento */
  now: number;
  /** Toque ajusta o horário, toque longo exclui a batida */
  editable?: boolean;
  /** Jornada em andamento: o intervalo atual também conta até agora */
  live?: boolean;
};

export function Timeline({ punches, now, editable = false, live = false }: Props) {
  const refDate = punches[0] ? toDateKey(punches[0].at) : null;
  const confirmDelete = useConfirmDeletePunch();

  return (
    <View>
      {punches.map((punch, i) => {
        const next = punches[i + 1];
        const isLast = i === punches.length - 1;
        const running = isLast && !punch.isDayEnd && (punch.kind === 'in' || live);
        const gapEnd = next?.at ?? (running ? now : null);
        const nextDay = refDate !== null && toDateKey(punch.at) !== refDate;

        return (
          <Animated.View key={punch.id} entering={FadeInDown.duration(250)} exiting={FadeOut.duration(150)} layout={LinearTransition}>
            <PunchRow
              punch={punch}
              nextDay={nextDay}
              onPress={editable ? () => router.push(`/batida/${punch.id}`) : undefined}
              onLongPress={editable ? () => confirmDelete(punch) : undefined}
            />
            {gapEnd !== null && !punch.isDayEnd ? (
              <Gap kind={punch.kind === 'in' ? 'work' : 'break'} ms={gapEnd - punch.at} running={running} />
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Vibração média + confirmação; depois de excluir, o toast oferece "Desfazer" */
export function useConfirmDeletePunch() {
  const db = useSQLiteContext();
  return (punch: Punch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Excluir batida?', `${punchLabel(punch)} às ${formatTime(punch.at)} será removida desta jornada.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const undo = await removePunch(db, punch.id);
            showToast('Batida excluída', { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
          } catch (e) {
            Alert.alert('Não foi possível excluir', (e as Error).message);
          }
        },
      },
    ]);
  };
}

function PunchRow({
  punch,
  nextDay,
  onPress,
  onLongPress,
}: {
  punch: Punch;
  nextDay: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const color: keyof ColorTokens = punch.kind === 'in' ? 'work' : punch.isDayEnd ? 'text' : 'break';
  const label = punchLabel(punch);
  const edited = punch.originalAt !== null;

  const content = (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            punch.kind === 'in' || punch.isDayEnd
              ? { backgroundColor: colors[color] }
              : { borderColor: colors[color], borderWidth: 2.5, backgroundColor: colors.surface },
          ]}
        />
      </View>
      <View style={styles.time}>
        <Text variant="headline" tabular>
          {formatTime(punch.at)}
        </Text>
        {nextDay ? (
          <Text variant="micro" color="break" style={styles.nextDay}>
            +1
          </Text>
        ) : null}
      </View>
      <Text variant="body" color="textMuted" style={styles.label}>
        {label}
      </Text>
      {edited ? (
        <View style={[styles.editedTag, { backgroundColor: colors.border }]}>
          <Text variant="micro" color="textMuted" style={styles.editedText}>
            editada
          </Text>
        </View>
      ) : null}
      {onPress && <Icon name="chevron_right" size={20} color="textMuted" />}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      android_ripple={{ color: colors.border }}
      accessibilityRole="button"
      accessibilityLabel={`${label} às ${formatTime(punch.at)}${edited ? ', editada' : ''}`}
      accessibilityHint="Toque para ajustar o horário. Toque e segure para excluir."
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'Excluir batida' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
      style={styles.pressable}
    >
      {content}
    </PressableScale>
  );
}

function Gap({ kind, ms, running }: { kind: 'work' | 'break'; ms: number; running: boolean }) {
  const { colors } = useTheme();
  const color = kind === 'work' ? colors.work : colors.break;
  return (
    <View style={styles.gap}>
      <View style={styles.rail}>
        <View
          style={[
            styles.line,
            kind === 'work' ? { backgroundColor: color } : { borderColor: color, borderLeftWidth: 2, borderStyle: 'dashed' },
          ]}
        />
      </View>
      <View style={[styles.gapTag, { backgroundColor: withAlpha(color, 0.12) }]}>
        <Icon name={kind === 'work' ? 'work' : 'coffee'} size={20} color={kind} />
        <Text variant="caption" color={kind} tabular>
          {formatDuration(ms)} {kind === 'work' ? 'trabalhando' : 'de intervalo'}
          {running ? ' · agora' : ''}
        </Text>
      </View>
    </View>
  );
}

const RAIL = 24;

const styles = StyleSheet.create({
  pressable: { borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouch },
  rail: { width: RAIL, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  time: { width: 64, flexDirection: 'row', alignItems: 'flex-start' },
  nextDay: { marginLeft: 2, letterSpacing: 0 },
  label: { flex: 1 },
  editedTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  editedText: { letterSpacing: 0.3, fontSize: 10 },
  gap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  line: { width: 2, flex: 1, minHeight: 44, borderRadius: 1 },
  gapTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
