import { addDays, startOfDay } from 'date-fns';

import { overlap } from './time';
import type { Span } from './types';

// Horas noturnas (PLANEJAMENTO.md §3.6): 22:00–05:00 no horário local.

export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 5;
/** Hora noturna reduzida da CLT: 52min30s contam como 1h */
export const REDUCED_NIGHT_HOUR_FACTOR = 60 / 52.5;

function at(day: Date, hour: number): number {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** Tempo de um intervalo que cai entre 22h e 5h (pode atravessar vários dias) */
export function nightMs(span: Span): number {
  if (span.end <= span.start) return 0;
  let total = 0;
  // Começa na véspera para pegar a janela 22h→5h que entra no primeiro dia
  for (let day = addDays(startOfDay(span.start), -1); day.getTime() < span.end; day = addDays(day, 1)) {
    const window = { start: at(day, NIGHT_START_HOUR), end: at(addDays(day, 1), NIGHT_END_HOUR) };
    total += overlap(span, window);
  }
  return total;
}
