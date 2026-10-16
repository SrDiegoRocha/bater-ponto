import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { periodDates, type Period } from '@/domain/period';
import type { DayStatus } from '@/domain/stats';
import { fromDateKey, HOUR, MINUTE } from '@/domain/time';
import type { DateKey, DayOffKind } from '@/domain/types';
import type { DayOvertime } from '@/domain/work-rules';
import { radius, spacing, useTheme, type ColorTokens } from '@/theme';

// Calendário do período (não do mês civil), §5.3. Cada estado tem cor + marcação própria.

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const dayOffColor: Record<DayOffKind, keyof ColorTokens> = {
  folga: 'dayOff',
  ferias: 'vacation',
  atestado: 'sickLeave',
  feriado: 'holiday',
};

export const dayOffLabel: Record<DayOffKind, string> = {
  folga: 'Folga',
  ferias: 'Férias',
  atestado: 'Atestado',
  feriado: 'Feriado',
};

type Props = {
  period: Period;
  days: ReadonlyMap<DateKey, DayStatus>;
  /** Dias com hora extra ganham a legenda na cor de extra */
  overtime?: ReadonlyMap<DateKey, DayOvertime>;
  today: DateKey;
  selected: ReadonlySet<DateKey>;
  onPressDay: (date: DateKey) => void;
  onLongPressDay: (date: DateKey) => void;
};

export function CalendarGrid({ period, days, overtime, today, selected, onPressDay, onLongPressDay }: Props) {
  const dates = periodDates(period);
  const leading = fromDateKey(dates[0]).getDay();
  const cells: (DateKey | null)[] = [...Array<null>(leading).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DateKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.container}>
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="micro" color="textMuted" align="center" style={styles.cell}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((date, i) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                status={days.get(date)}
                hasExtra={hasOvertime(overtime?.get(date))}
                isToday={date === today}
                isSelected={selected.has(date)}
                onPress={() => onPressDay(date)}
                onLongPress={() => onLongPressDay(date)}
              />
            ) : (
              <View key={`empty-${i}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const hasOvertime = (o: DayOvertime | undefined) => !!o && o.extraMs + o.extraDoubleMs >= MINUTE;

function DayCell({
  date,
  status,
  hasExtra,
  isToday,
  isSelected,
  onPress,
  onLongPress,
}: {
  date: DateKey;
  status: DayStatus | undefined;
  hasExtra: boolean;
  isToday: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const day = Number(date.slice(8));

  let fill: string | undefined;
  let textColor: keyof ColorTokens = 'text';
  let caption: string | null = null;
  let captionColor: keyof ColorTokens = 'textMuted';
  let ring: string | undefined;
  let a11y = '';

  switch (status?.type) {
    case 'worked':
      caption = `${Math.round((status.workedMs / HOUR) * 10) / 10}h`.replace('.', ',');
      captionColor = status.incomplete ? 'danger' : hasExtra ? 'extra' : 'work';
      if (status.holiday) ring = colors.holiday;
      a11y = status.incomplete ? 'jornada incompleta' : `trabalhado ${caption}${hasExtra ? ', com hora extra' : ''}`;
      break;
    case 'dayOff':
      fill = colors[dayOffColor[status.kind]];
      textColor = 'onPrimary';
      a11y = dayOffLabel[status.kind];
      break;
    case 'holiday':
      ring = colors.holiday;
      caption = 'feriado';
      captionColor = 'holiday';
      a11y = `feriado: ${status.holiday.name}`;
      break;
    case 'future':
      textColor = 'textMuted';
      if (status.holiday) ring = colors.holiday;
      break;
    case 'empty':
      a11y = 'sem registro';
      break;
  }

  return (
    <PressableScale
      style={styles.cell}
      scaleTo={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Dia ${day}${a11y ? `, ${a11y}` : ''}${isToday ? ', hoje' : ''}`}
    >
      <View
        style={[
          styles.bubble,
          fill && { backgroundColor: fill },
          ring && { borderColor: ring, borderWidth: 2 },
          isToday && !ring && { borderColor: colors.text, borderWidth: 1.5 },
          isSelected && { backgroundColor: colors.primary },
        ]}
      >
        <Text variant="headline" color={isSelected ? 'onPrimary' : textColor} tabular>
          {day}
        </Text>
      </View>
      <Text variant="micro" color={captionColor} style={styles.caption} numberOfLines={1}>
        {caption ?? ' '}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, minHeight: 56 },
  bubble: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { fontSize: 10, letterSpacing: 0, textTransform: 'none', marginTop: 2 },
});
