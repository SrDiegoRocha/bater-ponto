import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

// Horário digitado no teclado numérico: "0802" → 08:02. Feito para copiar o horário mostrado
// no app de ponto da empresa sem girar relógio nenhum.

export function TimeTyper({
  digits,
  onChangeDigits,
  invalid = false,
  autoFocus = true,
}: {
  digits: string;
  onChangeDigits: (digits: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const slots = digits.padEnd(4, ' ').split('');

  const slot = (i: number) => {
    const filled = slots[i] !== ' ';
    const active = i === digits.length;
    return (
      <View
        key={i}
        style={[
          styles.slot,
          {
            backgroundColor: colors.surface,
            borderColor: invalid ? colors.danger : active ? colors.primary : 'transparent',
          },
        ]}
      >
        <Text variant="display" tabular color={filled ? 'text' : 'textMuted'}>
          {filled ? slots[i] : '0'}
        </Text>
      </View>
    );
  };

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel={digits.length === 4 ? `Horário ${digits.slice(0, 2)}:${digits.slice(2)}` : 'Digite o horário'}
      style={styles.row}
    >
      {slot(0)}
      {slot(1)}
      <Text variant="display" color="textMuted">
        :
      </Text>
      {slot(2)}
      {slot(3)}
      <TextInput
        ref={input}
        value={digits}
        onChangeText={(t) => onChangeDigits(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  slot: {
    width: 56,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
