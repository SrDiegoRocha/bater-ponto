import { fromDateKey, MINUTE } from './time';
import type { DateKey } from './types';

// Meta diária e saldo (PLANEJAMENTO.md §3.5 e Q9). Padrão: 8h por dia, configurável.

export type DailyGoalConfig = {
  /** Meta padrão em minutos (480 = 8h) */
  defaultMinutes: number;
  /** Meta por dia da semana (0 = domingo … 6 = sábado), sobrepõe a padrão */
  byWeekday?: Partial<Record<number, number>>;
};

export const DEFAULT_GOAL: DailyGoalConfig = { defaultMinutes: 480 };

/** Meta do dia em ms. Folga, férias, atestado e feriado têm meta 0 (§3.5). */
export function goalForDate(date: DateKey, config: DailyGoalConfig, { isNonWorkingDay = false } = {}): number {
  if (isNonWorkingDay) return 0;
  const weekday = fromDateKey(date).getDay();
  const minutes = config.byWeekday?.[weekday] ?? config.defaultMinutes;
  return Math.max(0, minutes) * MINUTE;
}

/** Saldo do dia: positivo = crédito/extra, negativo = débito */
export function dayBalance(workedMs: number, goalMs: number): number {
  return workedMs - goalMs;
}
