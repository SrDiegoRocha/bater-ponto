import type { Holiday } from './holidays';
import { nightMs, REDUCED_NIGHT_HOUR_FACTOR } from './night-hours';
import { periodDates, type Period } from './period';
import { fromDateKey, HOUR } from './time';
import { buildDayHours, classifyHours, sumOvertime, type DayHours, type WorkRules } from './work-rules';
import { inss, irrf } from './tax-2026';
import type { DateKey, DayOff } from './types';
import { summarizeWorkday } from './workday';
import type { WorkdayInput } from './stats';

// Modo CLT da calculadora (PLANEJAMENTO.md §3.6). Trabalhador horista: cada hora é paga pelo valor/hora.
//
// - Dia comum: hora extra (padrão +50%) pelas regras da jornada (limite diário e semanal, work-rules.ts).
// - Feriado, folga marcada e (opcional) domingo: todas as horas = hora extra (padrão +100%).
//   A classificação usa a data de referência da jornada (dia em que começou).
// - Adicional noturno (22h–5h, padrão +20%), com hora noturna reduzida opcional (52min30s = 1h).
// - DSR sobre horas extras (opcional): extras ÷ dias úteis × (domingos + feriados) do período.
// - Descontos estimados: INSS e IRRF das tabelas de 2026.

export type CltConfig = {
  hourlyRate: number;
  rules: WorkRules;
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
  /** Dias da mesma semana antes do início do período: só fecham a conta do limite semanal */
  leadDays?: readonly DayHours[];
};

const cents = (reais: number) => Math.round(reais * 100);

export function computeCltPay({
  period,
  workdays,
  dayOffs,
  holidays,
  config,
  now,
  extraSimulatedMs = 0,
  leadDays = [],
}: Input): CltBreakdown {
  const rate = config.hourlyRate;

  const days = buildDayHours({ workdays, dayOffs, holidays, sundayDouble: config.sundayDouble, now });
  const classified = classifyHours([...leadDays, ...days], config.rules);
  const { normalMs, extraMs: workedExtraMs, extraDoubleMs } = sumOvertime(classified, period.start, period.end);
  const extraMs = workedExtraMs + extraSimulatedMs;

  let night = 0;
  for (const w of workdays) {
    if (w.status === 'incomplete') continue;
    const s = summarizeWorkday(w.punches, now);
    if (!s.isConsistent) continue;
    night += s.segments.reduce((sum, seg) => sum + nightMs(seg), 0);
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
