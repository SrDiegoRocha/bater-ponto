import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { spacing, timing, useTheme, type ColorTokens } from '@/theme';

// Gráfico de barras de uma série (horas por dia, por dia da semana).
// Regras do design de dados: barras finas com 2px de vão, topo arredondado (4px) ancorado na base,
// grade recessiva, uma linha de referência (meta) e toque numa barra mostra o valor (tooltip).

export type Bar = { key: string; label: string; value: number; color?: keyof ColorTokens; detail?: string };

type Props = {
  bars: readonly Bar[];
  /** Linha de referência (ex.: meta diária) */
  reference?: { value: number; label: string };
  formatValue: (v: number) => string;
  height?: number;
  /** Mostra o rótulo do eixo X só a cada N barras (períodos de 30 dias) */
  labelEvery?: number;
  accessibilityLabel: string;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const RADIUS = 4;
const GAP = 2;

function barPath(x: number, w: number, baseline: number, h: number): string {
  'worklet'; // roda na UI thread dentro de useAnimatedProps
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  const top = baseline - h;
  return `M${x},${baseline} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${baseline} Z`;
}

export function BarChart({ bars, reference, formatValue, height = 160, labelEvery = 1, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    grow.set(reduceMotion ? 1 : withTiming(1, timing.slow));
  }, [grow, reduceMotion, bars.length]);

  const max = Math.max(reference?.value ?? 0, ...bars.map((b) => b.value), 1) * 1.1;
  const barWidth = width > 0 ? width / Math.max(bars.length, 1) : 0;
  const scale = (v: number) => (v / max) * height;
  const sel = selected !== null ? bars[selected] : null;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.tooltip}>
        {sel ? (
          <Text variant="caption" tabular>
            {sel.label}: <Text variant="headline">{formatValue(sel.value)}</Text>
            {sel.detail ? <Text variant="caption" color="textMuted"> · {sel.detail}</Text> : null}
          </Text>
        ) : (
          <Text variant="caption" color="textMuted">
            Toque numa barra para ver o valor
          </Text>
        )}
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={colors.border} strokeWidth={1} />
            {bars.map((b, i) => (
              <AnimatedBar
                key={b.key}
                x={i * barWidth + GAP / 2}
                w={Math.max(1, barWidth - GAP)}
                baseline={height}
                h={scale(b.value)}
                grow={grow}
                fill={colors[b.color ?? 'work']}
                dimmed={selected !== null && selected !== i}
              />
            ))}
            {reference ? (
              <Line
                x1={0}
                x2={width}
                y1={height - scale(reference.value)}
                y2={height - scale(reference.value)}
                stroke={colors.textMuted}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}
          </Svg>
        ) : null}
        {/* Alvos de toque maiores que a barra: a coluna inteira */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.hitRow}>
            {bars.map((b, i) => (
              <Pressable
                key={b.key}
                style={styles.hit}
                accessibilityRole="button"
                accessibilityLabel={`${b.label}: ${formatValue(b.value)}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelected(selected === i ? null : i);
                }}
              />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.axis}>
        {bars.map((b, i) => (
          <Text key={b.key} variant="micro" color="textMuted" align="center" style={styles.axisLabel} numberOfLines={1}>
            {i % labelEvery === 0 ? b.label : ''}
          </Text>
        ))}
      </View>
      {reference ? (
        <Text variant="caption" color="textMuted">
          - - - {reference.label}
        </Text>
      ) : null}
    </View>
  );
}

function AnimatedBar({
  x,
  w,
  baseline,
  h,
  grow,
  fill,
  dimmed,
}: {
  x: number;
  w: number;
  baseline: number;
  h: number;
  grow: ReturnType<typeof useSharedValue<number>>;
  fill: string;
  dimmed: boolean;
}) {
  const props = useAnimatedProps(() => ({ d: barPath(x, w, baseline, h * grow.value) }));
  return <AnimatedPath animatedProps={props} fill={fill} opacity={dimmed ? 0.35 : 1} />;
}

const styles = StyleSheet.create({
  tooltip: { minHeight: 22, marginBottom: spacing.sm },
  hitRow: { flex: 1, flexDirection: 'row' },
  hit: { flex: 1 },
  axis: { flexDirection: 'row', marginTop: spacing.xs },
  axisLabel: { flex: 1, fontSize: 10, letterSpacing: 0 },
});
