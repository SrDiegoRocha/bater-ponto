import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Card, Icon, ProgressRing, Text } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { forecastGoal } from '@/domain/forecast';
import type { DayState } from '@/domain/state-machine';
import { HOUR, MINUTE } from '@/domain/time';
import type { Punch } from '@/domain/types';
import { summarizeWorkday } from '@/domain/workday';
import { formatDuration, formatTime } from '@/lib/format';
import { radius, spacing, useTheme, withAlpha, type ColorTokens } from '@/theme';

// Painel ao vivo do dia. Enquanto há trabalho ou intervalo correndo, re-renderiza a cada segundo
// (anel, relógio e contador do intervalo andam juntos). Dia encerrado ou sem batidas: fica parado.

type Props = {
  punches: readonly Punch[] | null;
  state: DayState;
  /** Limite diário (CLT): o que passar dele tende a ser hora extra */
  limitMs: number;
  /** Folga ou feriado: tudo já é extra, sem previsão */
  premiumDay: boolean;
  compensation: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function TodayHero(props: Props) {
  const live = props.state !== 'off' && !!props.punches?.length;
  const now = useNow(live ? 1000 : 60_000);
  return <HeroContent {...props} now={now} live={live} />;
}

function HeroContent({ punches, state, limitMs, premiumDay, compensation, now, live }: Props & { now: number; live: boolean }) {
  const summary = punches?.length ? summarizeWorkday(punches, now) : null;
  const workedMs = summary?.workedMs ?? 0;
  const last = punches?.at(-1) ?? null;
  const first = punches?.[0] ?? null;
  const breakMs = state === 'break' && last ? Math.max(0, now - last.at) : 0;
  const overMs = Math.max(0, workedMs - limitMs);
  const progress = limitMs > 0 ? workedMs / limitMs : 0;
  const forecast = forecastGoal(workedMs, premiumDay ? 0 : limitMs, state, now);

  const status: { label: string; detail: string | null; color: keyof ColorTokens; icon: 'play_arrow' | 'coffee' | 'check_circle' | 'bedtime' } =
    state === 'working'
      ? { label: 'Trabalhando', detail: last ? `Desde ${formatTime(last.at)}` : null, color: 'work', icon: 'play_arrow' }
      : state === 'break'
        ? { label: 'Em intervalo', detail: last ? `Desde ${formatTime(last.at)}` : null, color: 'break', icon: 'coffee' }
        : summary && last
          ? { label: 'Dia encerrado', detail: `${formatTime(first!.at)} → ${formatTime(last.at)}`, color: 'textMuted', icon: 'check_circle' }
          : { label: 'Fora do expediente', detail: 'Nada anotado hoje', color: 'textMuted', icon: 'bedtime' };

  return (
    <Card style={styles.card}>
      <View style={styles.status} accessibilityLiveRegion="polite">
        <View style={styles.statusRow}>
          {live ? <PulseDot color={status.color} /> : <Icon name={status.icon} size={20} color={status.color} />}
          <Text variant="headline" color={status.color === 'textMuted' ? 'text' : status.color}>
            {status.label}
          </Text>
        </View>
        {status.detail ? (
          <Text variant="caption" color="textMuted" tabular align="center">
            {status.detail}
          </Text>
        ) : null}
      </View>

      <ProgressRing progress={progress} size={228} color="work">
        <View style={styles.ringContent}>
          <Text variant="micro" color="textMuted">
            Trabalhado hoje
          </Text>
          <Clock ms={workedMs} showSeconds={state === 'working'} />
          {overMs >= MINUTE ? (
            <Text variant="caption" color="extra" tabular>
              +{formatDuration(overMs)} acima de {formatDuration(limitMs)}
            </Text>
          ) : (
            <Text variant="caption" color="textMuted" tabular>
              de {formatDuration(limitMs)} · {Math.min(100, Math.floor(progress * 100))}%
            </Text>
          )}
        </View>
      </ProgressRing>

      {state === 'break' ? (
        <BreakCounter ms={breakMs} />
      ) : null}

      <ForecastLine forecast={forecast} limitLabel={formatDuration(limitMs)} compensation={compensation} premiumDay={premiumDay} />
    </Card>
  );
}

function Clock({ ms, showSeconds }: { ms: number; showSeconds: boolean }) {
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  const s = Math.floor((ms % MINUTE) / 1000);
  return (
    <View style={styles.clock} accessible accessibilityLabel={`${h} horas e ${m} minutos trabalhados hoje`}>
      <Text variant="display" tabular style={styles.clockText}>
        {pad(h)}:{pad(m)}
      </Text>
      <Text variant="headline" color="textMuted" tabular style={[styles.seconds, !showSeconds && styles.hidden]}>
        {pad(s)}
      </Text>
    </View>
  );
}

/** Contador do intervalo em andamento, segundo a segundo */
function BreakCounter({ ms }: { ms: number }) {
  const { colors } = useTheme();
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  const s = Math.floor((ms % MINUTE) / 1000);
  return (
    <View style={[styles.breakBox, { backgroundColor: withAlpha(colors.break, 0.12) }]}>
      <Icon name="coffee" size={20} color="break" />
      <Text variant="body" color="break" style={styles.flex}>
        Intervalo agora
      </Text>
      <Text variant="headline" color="break" tabular accessibilityLabel={`${h} horas, ${m} minutos e ${s} segundos de intervalo`}>
        {h > 0 ? `${pad(h)}:` : ''}
        {pad(m)}:{pad(s)}
      </Text>
    </View>
  );
}

/** Bolinha que "respira": indica que o relógio está correndo */
function PulseDot({ color }: { color: keyof ColorTokens }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1200 }), -1, false));
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));

  return (
    <View style={styles.pulse}>
      <Animated.View style={[styles.pulseHalo, { backgroundColor: colors[color] }, halo]} />
      <View style={[styles.pulseDot, { backgroundColor: colors[color] }]} />
    </View>
  );
}

function ForecastLine({
  forecast,
  limitLabel,
  compensation,
  premiumDay,
}: {
  forecast: ReturnType<typeof forecastGoal>;
  limitLabel: string;
  compensation: boolean;
  premiumDay: boolean;
}) {
  let text: string | null = null;
  let color: keyof ColorTokens = 'textMuted';
  if (premiumDay) {
    text = 'Folga ou feriado: as horas de hoje contam como extra 100%';
    color = 'extra';
  } else {
    switch (forecast.kind) {
      case 'working':
        text = `Faltam ${formatDuration(forecast.remainingMs)} para ${limitLabel} · completa às ${formatTime(forecast.reachAt)}`;
        break;
      case 'break':
        text = `Faltam ${formatDuration(forecast.remainingMs)} para ${limitLabel} · voltando agora, completa às ${formatTime(forecast.reachIfResumeNowAt)}`;
        break;
      case 'done':
        // Com compensação, passar do limite do dia não é extra por si só (conta a semana)
        if (forecast.overMs >= MINUTE) {
          text = compensation ? 'Passou do limite do dia · com compensação, quem decide é a semana' : 'O que passou do limite tende a ser hora extra';
          color = 'extra';
        } else {
          text = `${limitLabel} completas`;
          color = 'work';
        }
        break;
    }
  }
  if (!text) return null;
  return (
    <Text variant="caption" color={color} align="center" tabular>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  status: { alignItems: 'center', gap: 2, alignSelf: 'stretch' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ringContent: { alignItems: 'center', gap: 2 },
  clock: { flexDirection: 'row', alignItems: 'baseline', paddingLeft: 26 },
  clockText: { fontSize: 52, lineHeight: 58 },
  seconds: { marginLeft: 2, width: 24 },
  hidden: { opacity: 0 },
  breakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  pulse: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseHalo: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  pulseDot: { width: 10, height: 10, borderRadius: 5 },
});
