import { Easing } from 'react-native-reanimated';

// Tokens de movimento (PLANEJAMENTO.md §7). Molas para interação, timing para mudança de dados.

export const spring = {
  snappy: { damping: 20, stiffness: 300 },
  gentle: { damping: 18, stiffness: 160 },
} as const;

export const timing = {
  fast: { duration: 150, easing: Easing.out(Easing.cubic) },
  base: { duration: 250, easing: Easing.out(Easing.cubic) },
  slow: { duration: 400, easing: Easing.out(Easing.cubic) },
} as const;

export const pressScale = 0.96;
