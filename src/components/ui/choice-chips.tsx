import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, View } from 'react-native';

import { fonts, minTouch, radius, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type Choice<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
  color?: keyof ColorTokens;
  /** Contador ao lado do rótulo (só nos filtros) */
  count?: number;
};

/**
 * Escolha única em controle segmentado: ocupa a largura toda, com partes iguais
 * (tipo de folga, tema, modo do salário…). Para 2–4 opções curtas.
 */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: scheme === 'dark' ? colors.bg : colors.border }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        const color = o.color ?? 'primary';
        return (
          <PressableScale
            key={o.value}
            scaleTo={0.97}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[
              styles.segment,
              selected && [styles.segmentSelected, { backgroundColor: colors.surfaceRaised }],
            ]}
          >
            {o.icon && <Icon name={o.icon} size={20} color={selected ? color : 'textMuted'} />}
            <Text variant="caption" color={selected ? 'text' : 'textMuted'} numberOfLines={2} align="center" style={[styles.label, selected && styles.labelSelected]}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * Filtros rápidos: chips numa linha que rola para os lados, de borda a borda da tela.
 * Nunca quebram linha nem deixam um "buraco" à direita.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      accessibilityRole="radiogroup"
    >
      {options.map((o) => {
        const selected = o.value === value;
        const color = o.color ?? 'primary';
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.count !== undefined ? `${o.label}, ${o.count}` : o.label}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: colors.text, borderColor: colors.text }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {o.icon && !selected ? <Icon name={o.icon} size={20} color={color} /> : null}
            <Text variant="caption" style={{ color: selected ? colors.bg : colors.text }}>
              {o.label}
            </Text>
            {o.count !== undefined ? (
              <View style={[styles.count, { backgroundColor: selected ? colors.bg : colors.surfaceRaised }]}>
                <Text variant="micro" tabular style={[styles.countText, { color: colors.text }]}>
                  {o.count}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, borderRadius: radius.md, gap: 3 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouch - 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md - 3,
  },
  segmentSelected: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)' },
  label: { flexShrink: 1 },
  labelSelected: { fontFamily: fonts.semibold },
  // Sangra até a borda da tela: a lista rola por baixo da margem lateral
  scroll: { marginHorizontal: -spacing.gutter, flexGrow: 0 },
  scrollContent: { paddingHorizontal: spacing.gutter, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 40,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  count: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  countText: { letterSpacing: 0 },
});
