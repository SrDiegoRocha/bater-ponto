import { addMonths, format, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { addDaysToKey, fromDateKey, toDateKey } from './time';
import type { DateKey } from './types';

// Período (competência) — regras P1–P5 do PLANEJAMENTO.md §3.4.
// Períodos são DERIVADOS do dia de início; nunca ficam salvos (P4).

export type Period = {
  /** Primeiro dia, inclusive */
  start: DateKey;
  /** Último dia, inclusive (véspera do início do próximo período) */
  end: DateKey;
  /** Ano/mês em que o período começa — dá nome ao período (P5) */
  year: number;
  /** 0–11 */
  month: number;
};

/** P1: dias 29–31 viram "último dia do mês" quando o mês é mais curto */
export function resolveStartDay(startDay: number, year: number, month: number): number {
  const clamped = Math.min(Math.max(Math.trunc(startDay), 1), 31);
  return Math.min(clamped, getDaysInMonth(new Date(year, month, 1)));
}

function startKey(startDay: number, year: number, month: number): DateKey {
  const normalized = new Date(year, month, 1);
  const y = normalized.getFullYear();
  const m = normalized.getMonth();
  return toDateKey(new Date(y, m, resolveStartDay(startDay, y, m)));
}

function periodStartingIn(startDay: number, year: number, month: number): Period {
  const first = new Date(year, month, 1);
  const next = addMonths(first, 1);
  return {
    start: startKey(startDay, first.getFullYear(), first.getMonth()),
    end: addDaysToKey(startKey(startDay, next.getFullYear(), next.getMonth()), -1),
    year: first.getFullYear(),
    month: first.getMonth(),
  };
}

export function getPeriodContaining(date: DateKey, startDay: number): Period {
  const d = fromDateKey(date);
  const sameMonth = periodStartingIn(startDay, d.getFullYear(), d.getMonth());
  if (date >= sameMonth.start) return sameMonth;
  return periodStartingIn(startDay, d.getFullYear(), d.getMonth() - 1);
}

export function shiftPeriod(period: Period, delta: number, startDay: number): Period {
  return periodStartingIn(startDay, period.year, period.month + delta);
}

export function periodContains(period: Period, date: DateKey): boolean {
  return date >= period.start && date <= period.end;
}

export function periodDates(period: Period): DateKey[] {
  const dates: DateKey[] = [];
  for (let key = period.start; key <= period.end; key = addDaysToKey(key, 1)) dates.push(key);
  return dates;
}

/** "Setembro 2026" */
export function periodLabel(period: Period): string {
  const label = format(new Date(period.year, period.month, 1), 'LLLL yyyy', { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "21/09 a 20/10" */
export function periodRangeLabel(period: Period): string {
  return `${format(fromDateKey(period.start), 'dd/MM')} a ${format(fromDateKey(period.end), 'dd/MM')}`;
}
