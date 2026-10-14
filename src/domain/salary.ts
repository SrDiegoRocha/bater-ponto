import { HOUR } from './time';

// Calculadora — modo simples (PLANEJAMENTO.md §3.6). O modo CLT entra na fase 2.
// Cálculos em ms/centavos; arredonda só no final.

export function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Salário bruto simples = horas trabalhadas × valor da hora, em centavos */
export function simpleGrossCents(workedMs: number, hourlyRate: number): number {
  if (!(hourlyRate > 0) || workedMs <= 0) return 0;
  return Math.round((workedMs / HOUR) * hourlyRate * 100);
}
