import type { Holiday } from './holidays';
import { addDaysToKey, fromDateKey, HOUR, MINUTE } from './time';
import type { DateKey, DayOff } from './types';
import { summarizeWorkday } from './workday';
import type { WorkdayInput } from './stats';

// Regras da jornada pela CLT (CF art. 7º, XIII; CLT arts. 58 e 59). Substitui a antiga "meta diária":
// quem tem escala variável não precisa de meta, só dos limites do contrato.
//
// - Hora extra é o que passar do limite DIÁRIO (padrão 8h) ou do SEMANAL (padrão 44h), sem contar duas vezes.
// - Acordo de compensação semanal (art. 59 §2º): o dia pode passar do limite diário sem virar extra, até 10h,
//   desde que a semana não passe do limite semanal (ex.: 8h48 de seg a sex para folgar no sábado).
// - Tolerância (art. 58 §1º): até 10 min a mais no dia não contam. Passou disso, conta tudo (Súmula 366 do TST).
// - Feriado, folga marcada e (opcional) domingo: todas as horas são extra 100% e não entram na conta da semana.
// - A semana vai de segunda a domingo.

export type WorkRules = {
  dailyLimitMinutes: number;
  weeklyLimitMinutes: number;
  compensation: boolean;
  tolerance: boolean;
};

export const CLT_RULES: WorkRules = {
  dailyLimitMinutes: 8 * 60,
  weeklyLimitMinutes: 44 * 60,
  compensation: false,
  tolerance: true,
};

/** Com acordo de compensação, o dia pode ir até 10h sem virar extra (art. 59) */
export const COMPENSATION_DAILY_CAP_MS = 10 * HOUR;
export const TOLERANCE_MS = 10 * MINUTE;

export type DayHours = {
  date: DateKey;
  workedMs: number;
  /** Feriado, folga marcada ou domingo (se configurado): tudo é extra 100% */
  premium: boolean;
};

export type DayOvertime = { normalMs: number; extraMs: number; extraDoubleMs: number };

/** Segunda-feira da semana da data */
export function weekStart(date: DateKey): DateKey {
  const weekday = fromDateKey(date).getDay(); // 0 = domingo
  return addDaysToKey(date, weekday === 0 ? -6 : 1 - weekday);
}

/** Horas trabalhadas por data de referência (jornadas incompletas ficam de fora até serem corrigidas) */
export function buildDayHours({
  workdays,
  dayOffs,
  holidays,
  sundayDouble,
  now,
}: {
  workdays: readonly WorkdayInput[];
  dayOffs: readonly DayOff[];
  holidays: ReadonlyMap<DateKey, Holiday>;
  sundayDouble: boolean;
  now: number;
}): DayHours[] {
  const offDates = new Set(dayOffs.map((d) => d.date));
  const worked = new Map<DateKey, number>();
  for (const w of workdays) {
    if (w.status === 'incomplete') continue;
    const s = summarizeWorkday(w.punches, now);
    if (!s.isConsistent) continue;
    worked.set(w.refDate, (worked.get(w.refDate) ?? 0) + s.workedMs);
  }
  return [...worked.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, workedMs]) => ({
      date,
      workedMs,
      premium: holidays.has(date) || offDates.has(date) || (sundayDouble && fromDateKey(date).getDay() === 0),
    }));
}

/** Separa as horas de cada dia em normais, extras e extras 100%. Dias em ordem de data. */
export function classifyHours(days: readonly DayHours[], rules: WorkRules): Map<DateKey, DayOvertime> {
  const result = new Map<DateKey, DayOvertime>();
  const dailyCap = rules.compensation ? COMPENSATION_DAILY_CAP_MS : rules.dailyLimitMinutes * MINUTE;
  const weeklyLimit = rules.weeklyLimitMinutes * MINUTE;
  let currentWeek: DateKey | null = null;
  let weeklyNormal = 0;

  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (day.premium) {
      result.set(day.date, { normalMs: 0, extraMs: 0, extraDoubleMs: day.workedMs });
      continue;
    }
    const week = weekStart(day.date);
    if (week !== currentWeek) {
      currentWeek = week;
      weeklyNormal = 0;
    }

    let extra = Math.max(0, day.workedMs - dailyCap);
    if (rules.tolerance && extra <= TOLERANCE_MS) extra = 0;
    let normal = day.workedMs - extra;

    // O que passar do limite da semana também é extra (sem contar de novo o que já foi extra no dia)
    const room = Math.max(0, weeklyLimit - weeklyNormal);
    if (normal > room) {
      extra += normal - room;
      normal = room;
    }
    weeklyNormal += normal;
    result.set(day.date, { normalMs: normal, extraMs: extra, extraDoubleMs: 0 });
  }
  return result;
}

/** Soma da classificação só nas datas pedidas (os dias antes do período servem só para fechar a semana) */
export function sumOvertime(classified: ReadonlyMap<DateKey, DayOvertime>, from: DateKey, to: DateKey): DayOvertime {
  const total: DayOvertime = { normalMs: 0, extraMs: 0, extraDoubleMs: 0 };
  for (const [date, o] of classified) {
    if (date < from || date > to) continue;
    total.normalMs += o.normalMs;
    total.extraMs += o.extraMs;
    total.extraDoubleMs += o.extraDoubleMs;
  }
  return total;
}

/** "8h por dia · 44h por semana" */
export function describeRules(rules: WorkRules): string {
  const h = (m: number) => (m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`);
  return `${h(rules.dailyLimitMinutes)} por dia · ${h(rules.weeklyLimitMinutes)} por semana`;
}
