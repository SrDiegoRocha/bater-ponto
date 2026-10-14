import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { maxFontScale, typography, useTheme, type ColorTokens, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  /** Algarismos tabulares — use em todo número que muda (relógios, totais) */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', tabular, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      style={[
        typography[variant],
        { color: colors[color] },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
