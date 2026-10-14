import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { minTouch, radius, spacing, useTheme } from '@/theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** Valor numérico com − / + (dia de início do período, meta diária…) */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  label: string;
}) {
  const { colors } = useTheme();
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const button = (delta: number, icon: 'remove' | 'add', disabled: boolean) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'add' ? 'Aumentar' : 'Diminuir'} ${label}`}
      disabled={disabled}
      onPress={() => change(delta)}
      style={[styles.button, { backgroundColor: colors.surfaceRaised, opacity: disabled ? 0.35 : 1 }]}
    >
      <Icon name={icon} />
    </PressableScale>
  );

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: format(value) }}>
      {button(-step, 'remove', value <= min)}
      <Text variant="title1" tabular align="center" style={styles.value}>
        {format(value)}
      </Text>
      {button(step, 'add', value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: {
    width: minTouch + 8,
    height: minTouch + 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { flex: 1 },
});
