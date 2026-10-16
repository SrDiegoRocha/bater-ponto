import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { parseTypedTime, type MinuteOfDay } from '@/domain/time-of-day';
import { fonts, radius, spacing, useTheme, withAlpha, type ColorTokens } from '@/theme';

import { TimeTyper } from './time-typer';

// Campo de horário (cadastro manual): caixa com rótulo em cima e o horário centralizado.
// Toque abre o teclado por dígitos (igual ao "Anotar batida"); quem preferir, usa o relógio do Android.
// "+1 dia" = o horário caiu no dia seguinte.

const pad = (n: number) => String(n).padStart(2, '0');
export const formatMinuteOfDay = (m: MinuteOfDay) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toDigits = (m: MinuteOfDay) => formatMinuteOfDay(m).replace(':', '');

export function TimeField({
  label,
  value,
  onChange,
  nextDay = false,
  accent = 'primary',
}: {
  label: string;
  value: MinuteOfDay;
  onChange: (value: MinuteOfDay) => void;
  nextDay?: boolean;
  /** Cor do rótulo (entrada = trabalho, saída = intervalo…) */
  accent?: keyof ColorTokens;
}) {
  const { colors } = useTheme();
  const [typing, setTyping] = useState(false);
  const [clock, setClock] = useState(false);

  return (
    <>
      <PressableScale
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatMinuteOfDay(value)}${nextDay ? ' do dia seguinte' : ''}`}
        accessibilityHint="Toque para digitar o horário"
        onPress={() => setTyping(true)}
        style={[styles.box, { backgroundColor: colors.surfaceRaised, borderColor: typing ? colors[accent] : colors.border }]}
      >
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: colors[accent] }]} />
          <Text variant="micro" color="textMuted">
            {label}
          </Text>
        </View>
        <Text style={[styles.value, { color: colors.text }]}>{formatMinuteOfDay(value)}</Text>
        <View style={styles.footer}>
          {nextDay ? (
            <View style={[styles.nextDay, { backgroundColor: withAlpha(colors.break, 0.14) }]}>
              <Text variant="micro" color="break" style={styles.nextDayText}>
                +1 dia
              </Text>
            </View>
          ) : (
            <Icon name="edit" size={20} color="textMuted" />
          )}
        </View>
      </PressableScale>

      {typing ? (
        <TypeTimeModal
          label={label}
          initial={value}
          onCancel={() => setTyping(false)}
          onUseClock={() => {
            setTyping(false);
            setClock(true);
          }}
          onDone={(m) => {
            setTyping(false);
            onChange(m);
          }}
        />
      ) : null}

      {clock && (
        <DateTimePicker
          value={new Date(2000, 0, 1, Math.floor(value / 60), value % 60)}
          mode="time"
          is24Hour
          accentColor={colors.primary}
          onValueChange={(_, date) => {
            setClock(false);
            onChange(date.getHours() * 60 + date.getMinutes());
          }}
          onDismiss={() => setClock(false)}
        />
      )}
    </>
  );
}

function TypeTimeModal({
  label,
  initial,
  onCancel,
  onDone,
  onUseClock,
}: {
  label: string;
  initial: MinuteOfDay;
  onCancel: () => void;
  onDone: (value: MinuteOfDay) => void;
  onUseClock: () => void;
}) {
  const { colors } = useTheme();
  const [digits, setDigits] = useState(() => toDigits(initial));
  const minutes = parseTypedTime(digits);
  const invalid = !digits.includes(' ') && minutes === null;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onCancel} accessibilityLabel="Fechar">
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceRaised }]} onPress={() => {}}>
            <Text variant="title2" align="center">
              {label}
            </Text>
            <TimeTyper value={digits} onChange={setDigits} invalid={invalid} />
            <Text variant="caption" color={invalid ? 'danger' : 'textMuted'} align="center">
              {invalid ? 'Horário inválido' : 'Toque num número para trocar só ele'}
            </Text>
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label="Cancelar" variant="secondary" block onPress={onCancel} />
              </View>
              <View style={styles.flex}>
                <Button
                  label="OK"
                  block
                  disabled={minutes === null}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onDone(minutes!);
                  }}
                />
              </View>
            </View>
            <Button label="Usar o relógio" icon="schedule" variant="ghost" size="sm" onPress={onUseClock} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Altura de linha igual ao tamanho da fonte e sem padding de fonte: número centrado de verdade
  value: {
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  footer: { height: 20, alignItems: 'center', justifyContent: 'center' },
  nextDay: { paddingHorizontal: spacing.sm, height: 20, borderRadius: radius.full, justifyContent: 'center' },
  nextDayText: { letterSpacing: 0.3 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing['2xl'],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
