import { StyleSheet, View } from 'react-native';

import { DAY, fromDateKey, HOUR } from '@/domain/time';
import type { DateKey, Span } from '@/domain/types';
import { radius, useTheme } from '@/theme';

// Mini-timeline horizontal (§5.3): da 00h da data de referência até 06h do dia seguinte (30h),
// para caber jornadas que passam da meia-noite.

const WINDOW = DAY + 6 * HOUR;

export function TimelineBar({ refDate, segments }: { refDate: DateKey; segments: readonly Span[] }) {
  const { colors } = useTheme();
  const origin = fromDateKey(refDate).getTime();
  const pct = (at: number) => Math.min(100, Math.max(0, ((at - origin) / WINDOW) * 100));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* marca da meia-noite */}
      <View style={[styles.midnight, { left: `${(DAY / WINDOW) * 100}%`, backgroundColor: colors.textMuted }]} />
      {segments.map((s) => (
        <View
          key={s.start}
          style={[
            styles.segment,
            { left: `${pct(s.start)}%`, width: `${Math.max(1, pct(s.end) - pct(s.start))}%`, backgroundColor: colors.work },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.full },
  midnight: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.6 },
});
