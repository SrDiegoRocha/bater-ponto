import type { TextStyle } from 'react-native';

// Inter em 4 pesos, embutida no build (PLANEJAMENTO.md §6.4). No Android cada peso é uma família
// com o nome do arquivo, por isso o peso vai no `fontFamily`, não no `fontWeight`.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type TypographyVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'headline'
  | 'body'
  | 'caption'
  | 'micro';

export const typography: Record<TypographyVariant, TextStyle> = {
  display: { fontFamily: fonts.semibold, fontSize: 56, lineHeight: 60, letterSpacing: -1.12 },
  title1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
  title2: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  micro: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
  },
};

/** Variantes grandes limitam a escala de fonte do sistema para não quebrar o layout (§6.4). */
export const maxFontScale: Partial<Record<TypographyVariant, number>> = {
  display: 1.3,
  title2: 1.3,
};
