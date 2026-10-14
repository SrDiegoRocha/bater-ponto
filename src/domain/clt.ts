import { goalForDate, type DailyGoalConfig } from './balance';
import type { Holiday } from './holidays';
import { nightMs, REDUCED_NIGHT_HOUR_FACTOR } from './night-hours';
import { periodDates, type Period } from './period';
import { fromDateKey, HOUR } from './time';
import { inss, irrf } from './tax-2026';
import type { DateKey, DayOff } from './types';
import { summarizeWorkday } from './workday';
import type { WorkdayInput } from './stats';

// Modo CLT da calculadora (PLANEJAMENTO.md §3.6). Trabalhador horista: cada hora é paga pelo valor/hora.
//
// - Dia comum: até a meta diária = hora normal; o que passar = hora extra (padrão +50%).
// - Feriado, folga marcada e (opcional) domingo: todas as horas = hora extra (padrão +100%).
//   A classificação usa a data de referência da jornada (dia em que começou).
// - Adicional noturno (22h–5h, padrão +20%), com hora noturna reduzida opcional (52min30s = 1h).
// - DSR sobre horas extras (opcional): extras ÷ dias úteis × (domingos + feriados) do período.
// - Descontos estimados: INSS e IRRF das tabelas de 2026.

export type CltConfig = {
  hourlyRate: number;
  goal: DailyGoalConfig;
  overtimePct: number;
  holidayOvertimePct: number;
  nightPct: number;
  nightReduced: boolean;
  dsrOnExtras: boolean;
  sundayDouble: boolean;
  dependents: number;
};

export type CltBreakdown = {
  normalMs: number;
  extraMs: number;
  extraDoubleMs: number;
  nightMs: number;
  /** Horas noturnas "fictas" ganhas com a hora reduzida */
  nightBonusMs: number;
  businessDays: number;
  restDays: number;
  /** Valores em centavos */
  normalPay: number;
  extraPay: number;
  extraDoublePay: number;
  nightBonusPay: number;
  nightAdditionalPay: number;
  dsrPay: number;
  gross: number;
  inss: number;
  irrf: number;
  net: number;
};

type Input = {
  period: Period;
  workdays: readonly WorkdayInput[];
  dayOffs: readonly DayOff[];
  holidays: ReadonlyMap<DateKey, Holiday>;
  config: CltConfig;
  now: number;
  /** Horas extras a mais (simulador "E se?"), pagas como extra comum */
  extraSimulatedMs?: number;
};

const cents = (reais: number) => Math.round(reais * 100);

export function computeCltPay({ period, workdays, dayOffs, holidays, config, now, extraSimulatedMs = 0 }: Input): CltBreakdown {
  const rate = config.hourlyRate;
  const dayOffDates = new Set(dayOffs.map((d) => d.date));
  const workedByDate = new Map<DateKey, { worked: number; night: number }>();

  for (const w of workdays) {
    if (w.status === 'incomplete') continue;
    const s = summarizeWorkday(w.punches, now);
    if (!s.isConsistent) continue;
    const entry = workedByDate.get(w.refDate) ?? { worked: 0, night: 0 };
    entry.worked += s.workedMs;
    entry.night += s.segments.reduce((sum, seg) => sum + nightMs(seg), 0);
    workedByDate.set(w.refDate, entry);
  }

  let normalMs = 0;
  let extraMs = extraSimulatedMs;
  let extraDoubleMs = 0;
  let night = 0;

  for (const [date, { worked, night: n }] of workedByDate) {
    night += n;
    const isSunday = fromDateKey(date).getDay() === 0;
    const doubleDay = holidays.has(date) || dayOffDates.has(date) || (config.sundayDouble && isSunday);
    if (doubleDay) {
      extraDoubleMs += worked;
      continue;
    }
    const goal = goalForDate(date, config.goal);
    normalMs += Math.min(worked, goal);
    extraMs += Math.max(0, worked - goal);
  }

  const nightBonusMs = config.nightReduced ? night * (REDUCED_NIGHT_HOUR_FACTOR - 1) : 0;
  const hours = (ms: number) => ms / HOUR;

  const normalPay = cents(hours(normalMs) * rate);
  const extraPay = cents(hours(extraMs) * rate * (1 + config.overtimePct / 100));
  const extraDoublePay = cents(hours(extraDoubleMs) * rate * (1 + config.holidayOvertimePct / 100));
  const nightBonusPay = cents(hours(nightBonusMs) * rate);
  const nightAdditionalPay = cents(hours(night + nightBonusMs) * rate * (config.nightPct / 100));

  // DSR: dias úteis = seg–sáb que não são feriado; descanso = domingos + feriados
  let businessDays = 0;
  let restDays = 0;
  for (const date of periodDates(period)) {
    if (fromDateKey(date).getDay() === 0 || holidays.has(date)) restDays++;
    else businessDays++;
  }
  const dsrPay =
    config.dsrOnExtras && businessDays > 0 ? Math.round(((extraPay + extraDoublePay) / businessDays) * restDays) : 0;

  const gross = normalPay + extraPay + extraDoublePay + nightBonusPay + nightAdditionalPay + dsrPay;
  const inssValue = inss(gross / 100);
  const irrfValue = irrf(gross / 100, inssValue, config.dependents);

  return {
    normalMs,
    extraMs,
    extraDoubleMs,
    nightMs: night,
    nightBonusMs,
    businessDays,
    restDays,
    normalPay,
    extraPay,
    extraDoublePay,
    nightBonusPay,
    nightAdditionalPay,
    dsrPay,
    gross,
    inss: cents(inssValue),
    irrf: cents(irrfValue),
    net: gross - cents(inssValue) - cents(irrfValue),
  };
}
