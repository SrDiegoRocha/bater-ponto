import { Host, Slider, Switch } from '@expo/ui';
import { StyleSheet, View } from 'react-native';

import { minTouch, spacing, useTheme } from '@/theme';

import { Text } from './text';

// Controles nativos (Jetpack Compose via @expo/ui), tingidos com a cor primária do tema.

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, scheme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Host matchContents colorScheme={scheme} seedColor={colors.primary}>
        <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
      </Host>
    </View>
  );
}

export function SliderRow({
  title,
  valueLabel,
  value,
  onValueChange,
  min,
  max,
  step,
}: {
  title: string;
  valueLabel: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const { colors, scheme } = useTheme();
  return (
    <View style={styles.slider}>
      <View style={styles.sliderHeader}>
        <Text variant="body">{title}</Text>
        <Text variant="headline" tabular>
          {valueLabel}
        </Text>
      </View>
      <Host style={styles.sliderHost} colorScheme={scheme} seedColor={colors.primary}>
        <Slider value={value} onValueChange={onValueChange} min={min} max={max} step={step} />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouch + spacing.sm },
  text: { flex: 1, gap: 2 },
  slider: { gap: spacing.xs },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sliderHost: { height: minTouch, width: '100%' },
});
