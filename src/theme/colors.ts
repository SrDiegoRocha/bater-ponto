import { brand, ink } from './palette';

// Tokens semânticos por tema (PLANEJAMENTO.md §6.3). Cada estado do domínio tem uma cor fixa,
// usada igual no anel, timeline, calendário, gráficos e chips.

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  work: string;
  break: string;
  dayOff: string;
  vacation: string;
  sickLeave: string;
  holiday: string;
  money: string;
  danger: string;
  night: string;
  /** Hora extra: a mesma cor em barras, gráficos e etiquetas */
  extra: string;
};

export const darkColors: ColorTokens = {
  bg: ink[900],
  surface: ink[850],
  surfaceRaised: ink[800],
  border: ink[700],
  text: '#F2F4F7',
  textMuted: ink[400],
  primary: brand.mint,
  onPrimary: ink[900],
  work: brand.mint,
  break: brand.amber,
  dayOff: '#8B7CF6',
  vacation: '#4FC3F7',
  sickLeave: '#F28FB1',
  holiday: '#FF9F5A',
  money: brand.gold,
  danger: '#FF6B6B',
  night: '#5B8DEF',
  extra: '#F062C0',
};

export const lightColors: ColorTokens = {
  bg: ink[50],
  surface: ink[0],
  surfaceRaised: ink[0],
  border: ink[200],
  text: ink[900],
  textMuted: ink[500],
  primary: brand.mintDeep,
  onPrimary: ink[0],
  work: brand.mintDeep,
  break: brand.amberDeep,
  dayOff: '#5B48D9',
  vacation: '#0A6FA0',
  sickLeave: '#B23A68',
  holiday: '#A84E0C',
  money: brand.goldDeep,
  danger: '#C62F2F',
  night: '#2F5DBF',
  extra: '#A8287C',
};

/** Tokens que viram texto/ícone sobre `surface` e `bg` e por isso precisam de contraste ≥ 4,5:1. */
export const textTokens = [
  'text',
  'textMuted',
  'primary',
  'work',
  'break',
  'dayOff',
  'vacation',
  'sickLeave',
  'holiday',
  'money',
  'danger',
  'night',
  'extra',
] as const satisfies readonly (keyof ColorTokens)[];
