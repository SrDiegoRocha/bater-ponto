import { differenceInCalendarDays } from 'date-fns';

import { fromDateKey } from './time';
import type { DateKey, Punch } from './types';

// Copiar a jornada de um dia para outro: mantém os horários de relógio e a distância em dias de cada
// batida até a data de referência (uma saída às 02:00 do dia seguinte continua no dia seguinte).

/** Novo instante para `at`, transportado de `fromRefDate` para `toRefDate` (seguro com mudança de fuso) */
export function moveToDate(at: number, fromRefDate: DateKey, toRefDate: DateKey): number {
  const original = new Date(at);
  const dayOffset = differenceInCalendarDays(original, fromDateKey(fromRefDate));
  const target = fromDateKey(toRefDate);
  target.setDate(target.getDate() + dayOffset);
  target.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return target.getTime();
}

export type CopiedShift = { start: number; end: number };

/** Turnos da jornada levados para outra data. Retorna null se a jornada não for completa (ENTRADA/SAÍDA pares). */
export function copyShifts(
  punches: readonly Pick<Punch, 'kind' | 'at'>[],
  fromRefDate: DateKey,
  toRefDate: DateKey,
): CopiedShift[] | null {
  if (punches.length === 0 || punches.length % 2 !== 0) return null;
  const shifts: CopiedShift[] = [];
  for (let i = 0; i < punches.length; i += 2) {
    const a = punches[i];
    const b = punches[i + 1];
    if (a.kind !== 'in' || b.kind !== 'out') return null;
    shifts.push({ start: moveToDate(a.at, fromRefDate, toRefDate), end: moveToDate(b.at, fromRefDate, toRefDate) });
  }
  return shifts;
}
