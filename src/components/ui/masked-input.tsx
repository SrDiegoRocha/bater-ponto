import { StyleSheet, TextInput, View } from 'react-native';

import { fonts, radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

// Campo numérico com máscara: o usuário só digita números e a máscara põe ponto, vírgula ou
// dois-pontos. O cursor fica sempre no fim (os dígitos entram pela direita, como em caixa eletrônico).

export type MaskedInputProps = {
  label: string;
  value: string;
  onChangeText: (masked: string) => void;
  mask: (text: string) => string;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  size?: 'md' | 'lg';
  onEndEditing?: () => void;
};

export function MaskedInput({
  label,
  value,
  onChangeText,
  mask,
  placeholder,
  prefix,
  suffix,
  invalid = false,
  size = 'md',
  onEndEditing,
}: MaskedInputProps) {
  const { colors } = useTheme();
  const large = size === 'lg';
  return (
    <View
      style={[
        styles.box,
        large && styles.boxLarge,
        { borderColor: invalid ? colors.danger : colors.border, backgroundColor: colors.surfaceRaised },
      ]}
    >
      {prefix ? (
        <Text variant={large ? 'title2' : 'body'} color="textMuted">
          {prefix}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(t) => onChangeText(mask(t))}
        onEndEditing={onEndEditing}
        onSubmitEditing={onEndEditing}
        selection={{ start: value.length, end: value.length }}
        keyboardType="number-pad"
        returnKeyType="done"
        contextMenuHidden
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[styles.input, large && styles.inputLarge, { color: colors.text }]}
      />
      {suffix ? (
        <Text variant="body" color="textMuted">
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  boxLarge: { paddingHorizontal: spacing.lg, gap: spacing.sm, minHeight: 56 },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.semibold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
    includeFontPadding: false,
  },
  inputLarge: { fontSize: 22 },
});
