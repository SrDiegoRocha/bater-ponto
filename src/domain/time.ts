import { addDays, format, parse } from 'date-fns';

import type { DateKey } from './types';

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Data de calendário local de um instante */
export function toDateKey(at: number | Date): DateKey {
  return format(at, 'yyyy-MM-dd');
}

/** Meia-noite local da data */
export function fromDateKey(key: DateKey): Date {
  return parse(key, 'yyyy-MM-dd', new Date(0));
}

export function addDaysToKey(key: DateKey, amount: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), amount));
}

/** Zera os segundos (ED5: edições têm precisão de minuto) */
export function floorToMinute(at: number): number {
  return Math.floor(at / MINUTE) * MINUTE;
}

export function overlap(a: { start: number; end: number }, b: { start: number; end: number }): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}
