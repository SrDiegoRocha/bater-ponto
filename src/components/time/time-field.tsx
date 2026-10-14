import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { MinuteOfDay } from '@/domain/time-of-day';
import { minTouch, radius, spacing, useTheme } from '@/theme';

// Campo compacto de horário (cadastro manual): mostra "08:00", toque abre o relógio nativo,
// −/+ ajustam de 5 em 5 minutos. "+1" indica que o horário caiu no dia seguinte.

const pad = (n: number) => String(n).padStart(2, '0');
export const formatMinuteOfDay = (m: MinuteOfDay) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export function TimeField({
  label,
  value,
  onChange,
  nextDay = false,
}: {
  label: string;
  value: MinuteOfDay;
  onChange: (value: MinuteOfDay) => void;
  nextDay?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const nudge = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange((value + delta + 1440) % 1440);
  };

  return (
    <View style={styles.row}>
      <Text variant="body" color="textMuted" style={styles.label}>
        {label}
      </Text>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: diminuir 5 minutos`} onPress={() => nudge(-5)} style={styles.small}>
        <Icon name="remove" size={20} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatMinuteOfDay(value)}${nextDay ? ' do dia seguinte' : ''}. Tocar para escolher.`}
        onPress={() => setOpen(true)}
        style={[styles.time, { backgroundColor: colors.surfaceRaised }]}
      >
        <Text variant="title2" tabular>
          {formatMinuteOfDay(value)}
        </Text>
        {nextDay ? (
          <Text variant="caption" color="break">
            +1
          </Text>
        ) : null}
      </PressableScale>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: aumentar 5 minutos`} onPress={() => nudge(5)} style={styles.small}>
        <Icon name="add" size={20} />
      </PressableScale>

      {open && (
        <DateTimePicker
          value={new Date(2000, 0, 1, Math.floor(value / 60), value % 60)}
          mode="time"
          is24Hour
          accentColor={colors.primary}
          onValueChange={(_, date) => {
            setOpen(false);
            onChange(date.getHours() * 60 + date.getMinutes());
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  small: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  time: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    minWidth: 104,
    height: minTouch + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
});
