import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { HOUR, MINUTE } from '@/domain/time';
import type { DateKey } from '@/domain/types';
import { formatDayRange, formatDuration, formatShortDate } from '@/lib/format';
import { fonts, radius, spacing, timing, useTheme, withAlpha, type ColorTokens } from '@/theme';

// Gráficos do Resumo, feitos com Views (sem SVG animado: nada roda fora da UI thread).
//
// DailyHoursChart: uma coluna por dia do período, empilhando horas normais (verde) e extras (cor de extra),
// com eixo de horas, linha do limite diário e marcação de folga/feriado. Toque num dia mostra os números.
// WeeklyHoursChart: uma barra horizontal por semana, com a marca do limite semanal (44h).

export type DayBar = {
  date: DateKey;
  normalMs: number;
  extraMs: number;
  /** Dia sem trabalho com marcação própria (folga, feriado…) */
  marker?: keyof ColorTokens;
  incomplete?: boolean;
};

const CHART_HEIGHT = 168;

/** Escala "redonda" do eixo: passos de 2h, 4h ou 6h até cobrir o maior valor */
function axisFor(maxMs: number): { top: number; step: number } {
  const hours = Math.max(1, maxMs / HOUR);
  const step = hours <= 8 ? 2 : hours <= 16 ? 4 : 6;
  return { top: Math.ceil(hours / step) * step * HOUR, step: step * HOUR };
}

function useGrow() {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    grow.set(reduceMotion ? 1 : withTiming(1, timing.slow));
  }, [grow, reduceMotion]);
  return grow;
}

export function DailyHoursChart({ days, limitMs, today }: { days: readonly DayBar[]; limitMs: number; today: DateKey }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const grow = useGrow();
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  const { top, step } = axisFor(Math.max(limitMs, ...days.map((d) => d.normalMs + d.extraMs)));
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const y = (ms: number) => (ms / top) * CHART_HEIGHT;
  const labelEvery = days.length > 20 ? 5 : days.length > 10 ? 3 : 1;
  const sel = selected !== null ? days[selected] : null;
  const totalExtra = days.reduce((sum, d) => sum + d.extraMs, 0);

  return (
    <View accessible accessibilityLabel={`Horas por dia. ${formatDuration(totalExtra)} de extras no período.`}>
      <View style={styles.readout}>
        {sel ? (
          <>
            <Text variant="headline">{formatShortDate(sel.date)}</Text>
            <Text variant="body" color="textMuted" tabular>
              {sel.incomplete
                ? 'jornada incompleta'
                : sel.normalMs + sel.extraMs === 0
                  ? 'sem horas'
                  : `${formatDuration(sel.normalMs + sel.extraMs)}`}
              {sel.extraMs >= MINUTE ? <Text variant="body" color="extra"> · +{formatDuration(sel.extraMs)} extra</Text> : null}
            </Text>
          </>
        ) : (
          <Text variant="caption" color="textMuted">
            Toque num dia para ver as horas
          </Text>
        )}
      </View>

      <View style={styles.plot}>
        <View style={[styles.yAxis, { height: CHART_HEIGHT }]}>
          {ticks.map((t) => (
            <Text key={t} variant="micro" color="textMuted" tabular style={[styles.yLabel, { bottom: y(t) - 7 }]}>
              {t / HOUR}h
            </Text>
          ))}
        </View>

        <View style={styles.flex}>
          <View style={{ height: CHART_HEIGHT }}>
            {ticks.map((t) => (
              <View key={t} style={[styles.grid, { bottom: y(t), backgroundColor: colors.border }]} />
            ))}

            <Animated.View style={[styles.bars, growStyle]}>
              {days.map((d, i) => {
                const dimmed = selected !== null && selected !== i;
                const normalH = y(d.normalMs);
                const extraH = y(d.extraMs);
                return (
                  <View key={d.date} style={[styles.column, dimmed && styles.dimmed]}>
                    {extraH > 0 ? (
                      <View style={[styles.segment, styles.topRound, { height: Math.max(2, extraH), backgroundColor: colors.extra }]} />
                    ) : null}
                    {normalH > 0 ? (
                      <View
                        style={[
                          styles.segment,
                          extraH === 0 && styles.topRound,
                          { height: Math.max(2, normalH), backgroundColor: colors.work },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </Animated.View>

            {/* Linha do limite diário */}
            <View style={[styles.limit, { bottom: y(limitMs), borderColor: colors.textMuted }]} pointerEvents="none" />

            {/* Coluna inteira é o alvo de toque */}
            <View style={StyleSheet.absoluteFill}>
              <View style={styles.hitRow}>
                {days.map((d, i) => (
                  <Pressable
                    key={d.date}
                    style={styles.flex}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatShortDate(d.date)}: ${formatDuration(d.normalMs + d.extraMs)}${d.extraMs >= MINUTE ? `, ${formatDuration(d.extraMs)} extra` : ''}`}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelected(selected === i ? null : i);
                    }}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.baseline, { backgroundColor: colors.textMuted }]} />

          {/* Marcadores de folga/feriado/incompleta, logo abaixo da base */}
          <View style={styles.markers}>
            {days.map((d) => (
              <View key={d.date} style={styles.markerCell}>
                {d.incomplete ? (
                  <View style={[styles.marker, { backgroundColor: colors.danger }]} />
                ) : d.marker ? (
                  <View style={[styles.marker, { backgroundColor: colors[d.marker] }]} />
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.xAxis}>
            {days.map((d, i) => {
              const isToday = d.date === today;
              const show = isToday || i % labelEvery === 0;
              return (
                <Text
                  key={d.date}
                  variant="micro"
                  color={isToday ? 'text' : 'textMuted'}
                  align="center"
                  numberOfLines={1}
                  style={[styles.xLabel, isToday && styles.today]}
                >
                  {show ? Number(d.date.slice(8)) : ''}
                </Text>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        <LegendSwatch color={colors.work} label="Normais" />
        <LegendSwatch color={colors.extra} label="Extras" />
        <View style={styles.legendItem}>
          <View style={[styles.legendDash, { borderColor: colors.textMuted }]} />
          <Text variant="caption" color="textMuted">
            Limite {formatDuration(limitMs)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.marker, { backgroundColor: colors.dayOff }]} />
          <Text variant="caption" color="textMuted">
            Folga ou feriado
          </Text>
        </View>
      </View>
    </View>
  );
}

export type WeekBar = { start: DateKey; end: DateKey; workedMs: number; extraMs: number; partial: boolean };

export function WeeklyHoursChart({ weeks, limitMs }: { weeks: readonly WeekBar[]; limitMs: number }) {
  const { colors } = useTheme();
  const grow = useGrow();
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  const max = Math.max(limitMs * 1.2, ...weeks.map((w) => w.workedMs));
  const pct = (ms: number) => `${Math.min(100, (ms / max) * 100)}%` as const;

  return (
    <View style={styles.weeks}>
      {weeks.map((w) => {
        const normal = Math.max(0, w.workedMs - w.extraMs);
        return (
          <View
            key={w.start}
            style={styles.week}
            accessible
            accessibilityLabel={`Semana de ${formatShortDate(w.start)} a ${formatShortDate(w.end)}: ${formatDuration(w.workedMs)}${w.extraMs >= MINUTE ? `, ${formatDuration(w.extraMs)} extra` : ''}`}
          >
            <View style={styles.weekHeader}>
              <Text variant="caption" color="textMuted" style={styles.flex}>
                {formatDayRange(w.start, w.end)}
                {w.partial ? ' · parcial' : ''}
              </Text>
              <Text variant="caption" tabular>
                {formatDuration(w.workedMs)}
                {w.extraMs >= MINUTE ? <Text variant="caption" color="extra"> · +{formatDuration(w.extraMs)}</Text> : null}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: withAlpha(colors.textMuted, 0.15) }]}>
              <Animated.View style={[styles.trackFill, growStyle]}>
                <View style={[styles.fillPart, { width: pct(normal), backgroundColor: colors.work }]} />
                {w.extraMs > 0 ? <View style={[styles.fillPart, { width: pct(w.extraMs), backgroundColor: colors.extra }]} /> : null}
              </Animated.View>
              <View style={[styles.weekLimit, { left: pct(limitMs), backgroundColor: colors.text }]} />
            </View>
          </View>
        );
      })}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendTick, { backgroundColor: colors.text }]} />
          <Text variant="caption" color="textMuted">
            Limite semanal {formatDuration(limitMs)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  readout: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.sm },
  plot: { flexDirection: 'row', gap: spacing.xs, paddingTop: 8 },
  yAxis: { width: 28 },
  yLabel: { position: 'absolute', right: 0, letterSpacing: 0, fontSize: 10, lineHeight: 14 },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  bars: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'flex-end', transformOrigin: 'bottom' },
  column: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end', paddingHorizontal: 1.5 },
  dimmed: { opacity: 0.3 },
  segment: { width: '100%' },
  topRound: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  limit: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  hitRow: { flex: 1, flexDirection: 'row' },
  baseline: { height: 1, opacity: 0.5 },
  markers: { flexDirection: 'row', height: 10, alignItems: 'center' },
  markerCell: { flex: 1, alignItems: 'center' },
  marker: { width: 5, height: 5, borderRadius: 3 },
  xAxis: { flexDirection: 'row' },
  xLabel: { flex: 1, fontSize: 10, letterSpacing: 0 },
  today: { fontFamily: fonts.bold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendDash: { width: 14, borderTopWidth: 1, borderStyle: 'dashed' },
  legendTick: { width: 2, height: 12, borderRadius: 1 },
  weeks: { gap: spacing.md },
  week: { gap: 6 },
  weekHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  track: { height: 12, borderRadius: radius.full, overflow: 'hidden' },
  trackFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', transformOrigin: 'left' },
  fillPart: { height: '100%' },
  weekLimit: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
});
