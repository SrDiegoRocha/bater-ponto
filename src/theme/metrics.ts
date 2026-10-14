// Grid de 4pt, raios e alvo de toque (PLANEJAMENTO.md §6.5).

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  /** Margem lateral padrão das telas */
  gutter: 20,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/** Alvo de toque mínimo do Android */
export const minTouch = 48;
