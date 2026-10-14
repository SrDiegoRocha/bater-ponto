import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { floorToMinute, MINUTE, toDateKey } from '@/domain/time';
import { clampToBounds, type EditBounds } from '@/domain/validation';
import { formatShortDate, formatTime } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

// Ajuste de horário do editor (PLANEJAMENTO.md §5.11): ±1/±5 min com repetição ao segurar,
// toque no horário abre o relógio nativo, chip de data abre o calendário. Limites sempre visíveis.

type Props = {
  initialValue: number;
  bounds: EditBounds;
  onChange: (value: number) => void;
  /** Mostra o horário original quando a batida foi editada */
  originalAt?: number | null;
};

type PickerMode = 'date' | 'time' | null;

export function TimeAdjuster({ initialValue, bounds, onChange, originalAt }: Props) {
  const { colors } = useTheme();
  const [value, setValue] = useState(() => clampToBounds(floorToMinute(initialValue), bounds));
  const [picker, setPicker] = useState<PickerMode>(null);
  const valueRef = useRef(value);
  const shake = useSharedValue(0);

  useEffect(() => {
    valueRef.current = value;
    onChange(value);
  }, [value, onChange]);

  const hitLimit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    shake.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(0, { duration: 50 })));
  };

  /** Aplica um passo; retorna false se encostou no limite */
  const step = (deltaMinutes: number): boolean => {
    const current = valueRef.current;
    const next = clampToBounds(current + deltaMinutes * MINUTE, bounds);
    if (next === current) {
      hitLimit();
      return false;
    }
    Haptics.selectionAsync().catch(() => {});
    valueRef.current = next;
    setValue(next);
    return true;
  };

  const setFromPicker = (date: Date) => {
    const base = new Date(valueRef.current);
    const next =
      picker === 'date'
        ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours(), base.getMinutes())
        : new Date(base.getFullYear(), base.getMonth(), base.getDate(), date.getHours(), date.getMinutes());
    const clamped = clampToBounds(next.getTime(), bounds);
    if (clamped !== next.getTime()) hitLimit();
    setValue(clamped);
  };

  const timeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const canDecrease = bounds.min === null || value - MINUTE >= bounds.min;
  const canIncrease = value + MINUTE <= bounds.max;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Data: ${formatShortDate(value)}. Tocar para mudar.`}
        onPress={() => setPicker('date')}
        style={[styles.dateChip, { borderColor: colors.border }]}
        hitSlop={8}
      >
        <Icon name="calendar_today" size={20} color="textMuted" />
        <Text variant="caption" color="textMuted">
          {formatShortDate(value)}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Horário ${formatTime(value)}. Tocar para escolher no relógio.`}
        onPress={() => setPicker('time')}
      >
        <Animated.View style={timeStyle}>
          <Text variant="display" tabular align="center">
            {formatTime(value)}
          </Text>
        </Animated.View>
      </Pressable>

      {originalAt != null && originalAt !== value ? (
        <Text variant="caption" color="textMuted" align="center">
          original {formatTime(originalAt)}
        </Text>
      ) : null}

      <View style={styles.buttons}>
        <RepeatButton label="−5" onStep={() => step(-5)} disabled={!canDecrease} />
        <RepeatButton label="−1" onStep={() => step(-1)} disabled={!canDecrease} />
        <View style={styles.spacer} />
        <RepeatButton label="+1" onStep={() => step(1)} disabled={!canIncrease} />
        <RepeatButton label="+5" onStep={() => step(5)} disabled={!canIncrease} />
      </View>

      <Text variant="caption" color="textMuted" align="center">
        {describeBounds(bounds, value)}
      </Text>

      {picker && (
        <DateTimePicker
          value={new Date(value)}
          mode={picker}
          is24Hour
          accentColor={colors.primary}
          minimumDate={picker === 'date' && bounds.min !== null ? new Date(bounds.min) : undefined}
          maximumDate={picker === 'date' ? new Date(bounds.max) : undefined}
          onValueChange={(_, date) => {
            setPicker(null);
            setFromPicker(date);
          }}
          onDismiss={() => setPicker(null)}
        />
      )}
    </View>
  );
}

function describeBounds(bounds: EditBounds, value: number): string {
  const sameDay = (at: number) => toDateKey(at) === toDateKey(value);
  const label = (at: number) => (sameDay(at) ? formatTime(at) : `${formatTime(at)} de ${formatShortDate(at)}`);
  const max = bounds.max >= Date.now() - MINUTE ? 'agora' : label(bounds.max);
  return bounds.min === null ? `até ${max}` : `entre ${label(bounds.min)} e ${max}`;
}

/** Botão que repete o passo enquanto pressionado, acelerando (300ms → 80ms) */
function RepeatButton({ label, onStep, disabled }: { label: string; onStep: () => boolean; disabled: boolean }) {
  const { colors } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const repeat = (delay: number) => {
    timer.current = setTimeout(() => {
      if (stepRef.current()) repeat(Math.max(80, delay * 0.8));
    }, delay);
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label} minutos`}
      disabled={disabled}
      onPressIn={() => {
        if (stepRef.current()) repeat(400);
      }}
      onPressOut={stop}
      style={[styles.stepButton, { backgroundColor: colors.surfaceRaised, opacity: disabled ? 0.35 : 1 }]}
    >
      <Text variant="headline" tabular>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: 'stretch' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { width: spacing.md },
  stepButton: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
