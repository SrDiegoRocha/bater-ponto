import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { minTouch, radius, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type Choice<T extends string> = { value: T; label: string; icon?: IconName; color?: keyof ColorTokens };

/** Escolha única em chips grandes (tipo de folga, tema, etc.) */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        const color = o.color ?? 'primary';
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                borderColor: selected ? colors[color] : colors.border,
              },
            ]}
          >
            {o.icon && <Icon name={o.icon} size={20} color={selected ? color : 'textMuted'} />}
            <Text variant="caption" color={selected ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
});
