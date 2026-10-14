import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { parseMoney } from '@/lib/money';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

// Campo de valor em R$ com teclado numérico. Aceita "25,50" ou "25.50".

const toText = (value: number) => (value > 0 ? value.toFixed(2).replace('.', ',') : '');

export function MoneyInput({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (value: number) => void;
  label: string;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState<string | null>(null);

  const commit = () => {
    if (text === null) return;
    const parsed = parseMoney(text) ?? 0;
    setText(null);
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
      <Text variant="title2" color="textMuted">
        R$
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={text ?? toText(value)}
        onChangeText={setText}
        onEndEditing={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        placeholder="0,00"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 22, fontVariant: ['tabular-nums'], paddingVertical: spacing.sm },
});
