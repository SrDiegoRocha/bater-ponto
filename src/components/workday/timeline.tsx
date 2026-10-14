import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { toDateKey } from '@/domain/time';
import type { Punch } from '@/domain/types';
import { formatDuration, formatTime } from '@/lib/format';
import { minTouch, spacing, useTheme, type ColorTokens } from '@/theme';

// Linha do tempo vertical de uma jornada (§5.2 / §5.4). Cada batida é tocável → editor de horário.

export function punchLabel(punch: Pick<Punch, 'kind' | 'isDayStart' | 'isDayEnd'>): string {
  if (punch.isDayStart) return 'Início do dia';
  if (punch.isDayEnd) return 'Fim do dia';
  return punch.kind === 'out' ? 'Pausa' : 'Voltou';
}

type Props = {
  punches: readonly Punch[];
  /** Agora, para o trecho em andamento */
  now: number;
  onPressPunch?: (punch: Punch) => void;
};

export function Timeline({ punches, now, onPressPunch }: Props) {
  const refDate = punches[0] ? toDateKey(punches[0].at) : null;

  return (
    <View>
      {punches.map((punch, i) => {
        const next = punches[i + 1];
        const isLast = i === punches.length - 1;
        const running = isLast && punch.kind === 'in' && !punch.isDayEnd;
        const gapEnd = next?.at ?? (running ? now : null);
        const nextDay = refDate !== null && toDateKey(punch.at) !== refDate;

        return (
          <Animated.View key={punch.id} entering={FadeInDown.duration(250)} layout={LinearTransition}>
            <PunchRow
              punch={punch}
              nextDay={nextDay}
              onPress={onPressPunch ? () => onPressPunch(punch) : undefined}
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

function PunchRow({ punch, nextDay, onPress }: { punch: Punch; nextDay: boolean; onPress?: () => void }) {
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
              : { borderColor: colors[color], borderWidth: 2.5 },
          ]}
        />
      </View>
      <Text variant="headline" tabular style={styles.time}>
        {formatTime(punch.at)}
        {nextDay ? <Text variant="caption" color="textMuted"> +1</Text> : null}
      </Text>
      <Text variant="body" color="textMuted" style={styles.label}>
        {label}
      </Text>
      {edited && <Icon name="edit" size={20} color="textMuted" />}
      {onPress && <Icon name="chevron_right" size={20} color="textMuted" />}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} às ${formatTime(punch.at)}${edited ? ', editada' : ''}. Tocar para ajustar.`}
    >
      {content}
    </PressableScale>
  );
}

function Gap({ kind, ms, running }: { kind: 'work' | 'break'; ms: number; running: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      <View style={styles.rail}>
        <View
          style={[
            styles.line,
            kind === 'work'
              ? { backgroundColor: colors.work }
              : { borderColor: colors.break, borderLeftWidth: 2, borderStyle: 'dashed' },
          ]}
        />
      </View>
      <Text variant="caption" color={kind === 'work' ? 'textMuted' : 'break'} tabular>
        {formatDuration(ms)} {kind === 'work' ? 'trabalhando' : 'de intervalo'}
        {running ? ' · agora' : ''}
      </Text>
    </View>
  );
}

const RAIL = 24;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouch },
  rail: { width: RAIL, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  time: { width: 72 },
  label: { flex: 1 },
  gap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  line: { width: 2, flex: 1, minHeight: 36, borderRadius: 1 },
});
