import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { spacing, useTheme } from '@/theme';

// Símbolo "o Ponto" e lockup (PLANEJAMENTO.md §6.2). Mesma geometria de assets/brand/symbol.svg.

export function BrandSymbol({ size = 48, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const fill = color ?? colors.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Bater Ponto">
      <Path d="M12 3 A9 9 0 1 1 4.2058 7.5" stroke={fill} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Circle cx={4.2058} cy={7.5} r={2.25} fill={fill} />
    </Svg>
  );
}

/** Símbolo + wordmark "bater ponto." (o ponto final sempre na cor primária) */
export function BrandLockup({ size = 40 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <BrandSymbol size={size} />
      <Text variant="title2" style={{ fontSize: size * 0.7, lineHeight: size, letterSpacing: -0.02 * size * 0.7 }}>
        bater ponto<Text variant="title2" color="primary" style={{ fontSize: size * 0.7 }}>.</Text>
      </Text>
    </View>
  );
}
