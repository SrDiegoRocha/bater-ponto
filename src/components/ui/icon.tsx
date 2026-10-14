import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme, type ColorTokens } from '@/theme';

// Material Symbols via expo-symbols (§6.6). Um peso, tamanhos 20/24.

export type IconName = NonNullable<Extract<SymbolViewProps['name'], { android?: unknown }>['android']>;

export type IconProps = {
  name: IconName;
  size?: 20 | 24 | 28 | 32;
  color?: keyof ColorTokens;
};

export function Icon({ name, size = 24, color = 'text' }: IconProps) {
  const { colors } = useTheme();
  return <SymbolView name={{ android: name }} size={size} tintColor={colors[color]} />;
}
