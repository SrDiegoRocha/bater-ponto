import { StyleSheet, View } from 'react-native';

import { DAY, fromDateKey, HOUR } from '@/domain/time';
import type { DateKey, Span } from '@/domain/types';
import { radius, useTheme } from '@/theme';

// Mini-timeline horizontal (§5.3): da 00h da data de referência até 06h do dia seguinte (30h),
// para caber jornadas que passam da meia-noite. As últimas `extraMs` trabalhadas aparecem na cor
// de hora extra; marcas discretas a cada 6h ajudam a ler o horário.

const WINDOW = DAY + 6 * HOUR;
const TICKS = [6, 12, 18, 24].map((h) => (h * HOUR) / WINDOW);

/** Divide os trechos trabalhados em normal/extra, tirando o extra do fim da jornada */
function splitExtra(segments: readonly Span[], extraMs: number): { span: Span; extra: boolean }[] {
  const parts: { span: Span; extra: boolean }[] = [];
  let left = Math.max(0, extraMs);
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    const take = Math.min(left, s.end - s.start);
    left -= take;
    if (take > 0) parts.unshift({ span: { start: s.end - take, end: s.end }, extra: true });
    if (s.end - take > s.start) parts.unshift({ span: { start: s.start, end: s.end - take }, extra: false });
  }
  return parts;
}

export function TimelineBar({ refDate, segments, extraMs = 0 }: { refDate: DateKey; segments: readonly Span[]; extraMs?: number }) {
  const { colors } = useTheme();
  const origin = fromDateKey(refDate).getTime();
  const pct = (at: number) => Math.min(100, Math.max(0, ((at - origin) / WINDOW) * 100));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {TICKS.map((t) => (
        <View key={t} style={[styles.tick, { left: `${t * 100}%`, backgroundColor: colors.textMuted }]} />
      ))}
      {splitExtra(segments, extraMs).map(({ span, extra }) => (
        <View
          key={`${span.start}-${extra}`}
          style={[
            styles.segment,
            {
              left: `${pct(span.start)}%`,
              width: `${Math.max(1, pct(span.end) - pct(span.start))}%`,
              backgroundColor: extra ? colors.extra : colors.work,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.full },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.35 },
});
