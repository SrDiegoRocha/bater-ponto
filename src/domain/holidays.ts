import { addDaysToKey, fromDateKey, toDateKey } from './time';
import type { DateKey } from './types';

// Feriados nacionais automáticos (PLANEJAMENTO.md §3.7). Calculados localmente, sem API.

export type HolidayKind = 'national' | 'optional' | 'custom';

export type Holiday = {
  /** Identificador estável, usado para desativar um feriado (H4) */
  key: string;
  date: DateKey;
  name: string;
  kind: HolidayKind;
};

export type HolidayOverride =
  | { kind: 'disabled'; holidayKey: string; year: number | null }
  | { kind: 'custom'; id: string; name: string; date: DateKey | null; monthDay: string | null };

/** Domingo de Páscoa (gregoriano) — algoritmo de Meeus/Jones/Butcher */
export function easterSunday(year: number): DateKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateKey(new Date(year, month - 1, day));
}

const FIXED: { key: string; monthDay: string; name: string }[] = [
  { key: 'confraternizacao', monthDay: '01-01', name: 'Confraternização Universal' },
  { key: 'tiradentes', monthDay: '04-21', name: 'Tiradentes' },
  { key: 'trabalho', monthDay: '05-01', name: 'Dia do Trabalho' },
  { key: 'independencia', monthDay: '09-07', name: 'Independência do Brasil' },
  { key: 'aparecida', monthDay: '10-12', name: 'Nossa Senhora Aparecida' },
  { key: 'finados', monthDay: '11-02', name: 'Finados' },
  { key: 'republica', monthDay: '11-15', name: 'Proclamação da República' },
  { key: 'consciencia-negra', monthDay: '11-20', name: 'Dia da Consciência Negra' },
  { key: 'natal', monthDay: '12-25', name: 'Natal' },
];

export function nationalHolidays(year: number, { includeOptional = false } = {}): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = FIXED.map((h) => ({
    key: h.key,
    date: `${year}-${h.monthDay}`,
    name: h.name,
    kind: 'national',
  }));
  list.push({ key: 'sexta-santa', date: addDaysToKey(easter, -2), name: 'Sexta-feira Santa', kind: 'national' });

  if (includeOptional) {
    list.push(
      { key: 'carnaval-segunda', date: addDaysToKey(easter, -48), name: 'Carnaval', kind: 'optional' },
      { key: 'carnaval-terca', date: addDaysToKey(easter, -47), name: 'Carnaval', kind: 'optional' },
      { key: 'cinzas', date: addDaysToKey(easter, -46), name: 'Quarta-feira de Cinzas', kind: 'optional' },
      { key: 'corpus-christi', date: addDaysToKey(easter, 60), name: 'Corpus Christi', kind: 'optional' },
    );
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Feriados ativos de um ano, já com desativações (H4) e feriados próprios (H5) aplicados */
export function holidaysForYear(
  year: number,
  overrides: readonly HolidayOverride[],
  { includeOptional = false } = {},
): Holiday[] {
  const disabled = overrides.filter((o) => o.kind === 'disabled');
  const active = nationalHolidays(year, { includeOptional }).filter(
    (h) => !disabled.some((d) => d.holidayKey === h.key && (d.year === null || d.year === year)),
  );

  for (const o of overrides) {
    if (o.kind !== 'custom') continue;
    const date = o.monthDay ? `${year}-${o.monthDay}` : o.date;
    if (!date || !date.startsWith(`${year}-`)) continue;
    if (disabled.some((d) => d.holidayKey === `custom:${o.id}` && (d.year === null || d.year === year))) continue;
    active.push({ key: `custom:${o.id}`, date, name: o.name, kind: 'custom' });
  }
  return active.sort((a, b) => a.date.localeCompare(b.date));
}

/** Mapa data → feriado para um intervalo de datas (pode atravessar anos, como um período 21/12–20/01) */
export function holidaysInRange(
  start: DateKey,
  end: DateKey,
  overrides: readonly HolidayOverride[],
  options: { includeOptional?: boolean } = {},
): Map<DateKey, Holiday> {
  const map = new Map<DateKey, Holiday>();
  const fromYear = fromDateKey(start).getFullYear();
  const toYear = fromDateKey(end).getFullYear();
  for (let year = fromYear; year <= toYear; year++) {
    for (const h of holidaysForYear(year, overrides, options)) {
      if (h.date >= start && h.date <= end && !map.has(h.date)) map.set(h.date, h);
    }
  }
  return map;
}
