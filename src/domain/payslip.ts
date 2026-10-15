import type { CltBreakdown } from './clt';
import { HOUR, MINUTE } from './time';
import type { DateKey } from './types';

// Conferência do holerite (CLT): o usuário digita o que a empresa pagou no período e o app compara
// com o que ele calculou a partir das batidas anotadas. Campo vazio = não conferir aquele item.
//
// Holerites mostram as horas de dois jeitos: decimal ("12,50" = 12h30) ou relógio ("12:30").

export type HoursFormat = 'decimal' | 'clock';

export type PayslipValues = {
  hoursFormat: HoursFormat;
  /** Horas em ms, valores em centavos; null = não informado */
  extraMs: number | null;
  extraCents: number | null;
  extraDoubleMs: number | null;
  extraDoubleCents: number | null;
  nightMs: number | null;
  nightCents: number | null;
  dsrCents: number | null;
};

export type Payslip = PayslipValues & { periodStart: DateKey; periodEnd: DateKey; updatedAt: number };

export const EMPTY_PAYSLIP: PayslipValues = {
  hoursFormat: 'decimal',
  extraMs: null,
  extraCents: null,
  extraDoubleMs: null,
  extraDoubleCents: null,
  nightMs: null,
  nightCents: null,
  dsrCents: null,
};

/** Diferenças menores que isso são arredondamento, não erro de pagamento */
export const HOURS_TOLERANCE_MS = 5 * MINUTE;
export const MONEY_TOLERANCE_CENTS = 100;

/** "12,5" / "12,50" (decimal) ou "12:30" / "12,30" / "12h30" (relógio) → ms; vazio ou inválido → null */
export function parseHours(text: string, format: HoursFormat): number | null {
  const t = text.trim().toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  if (format === 'decimal') {
    if (!/^\d+([.,]\d+)?$/.test(t)) return null;
    return Math.round(Number(t.replace(',', '.')) * 60) * MINUTE;
  }
  const match = /^(\d+)(?:[:.,h](\d{1,2})?)?$/.exec(t);
  if (!match) return null;
  const minutes = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
  if (minutes >= 60) return null;
  return Number(match[1]) * HOUR + minutes * MINUTE;
}

/** Texto para o campo de horas no formato escolhido (inverso de parseHours) */
export function formatHoursInput(ms: number | null, format: HoursFormat): string {
  if (ms === null) return '';
  const totalMinutes = Math.round(ms / MINUTE);
  if (format === 'clock') return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`;
  return String(Math.round((totalMinutes / 60) * 100) / 100).replace('.', ',');
}

export type CheckStatus = 'ok' | 'underpaid' | 'overpaid';

export type CheckRow = {
  key: 'extraHours' | 'extraValue' | 'extraDoubleHours' | 'extraDoubleValue' | 'nightHours' | 'nightValue' | 'dsrValue';
  label: string;
  unit: 'hours' | 'money';
  paid: number;
  expected: number;
  /** pago − calculado: negativo = faltou pagar */
  diff: number;
  status: CheckStatus;
};

export type PayslipCheck = {
  rows: CheckRow[];
  /** Soma do que faltou nos itens em R$ (só itens pagos a menos) */
  missingCents: number;
  /** Itens de horas pagos a menos */
  missingHoursRows: number;
};

type Pcts = { overtimePct: number; holidayOvertimePct: number };

export function comparePayslip(p: PayslipValues, b: CltBreakdown, { overtimePct, holidayOvertimePct }: Pcts): PayslipCheck {
  const rows: CheckRow[] = [];
  const add = (key: CheckRow['key'], label: string, unit: CheckRow['unit'], paid: number | null, expected: number) => {
    if (paid === null) return;
    const diff = paid - expected;
    const tolerance = unit === 'hours' ? HOURS_TOLERANCE_MS : MONEY_TOLERANCE_CENTS;
    const status: CheckStatus = Math.abs(diff) < tolerance ? 'ok' : diff < 0 ? 'underpaid' : 'overpaid';
    rows.push({ key, label, unit, paid, expected, diff, status });
  };

  add('extraHours', `Horas extras ${overtimePct}%`, 'hours', p.extraMs, b.extraMs);
  add('extraValue', `Valor das extras ${overtimePct}%`, 'money', p.extraCents, b.extraPay);
  add('extraDoubleHours', `Horas extras ${holidayOvertimePct}%`, 'hours', p.extraDoubleMs, b.extraDoubleMs);
  add('extraDoubleValue', `Valor das extras ${holidayOvertimePct}%`, 'money', p.extraDoubleCents, b.extraDoublePay);
  // No holerite as horas noturnas já vêm com a hora reduzida aplicada
  add('nightHours', 'Horas de adicional noturno', 'hours', p.nightMs, b.nightMs + b.nightBonusMs);
  add('nightValue', 'Valor do adicional noturno', 'money', p.nightCents, b.nightAdditionalPay);
  add('dsrValue', 'DSR sobre extras', 'money', p.dsrCents, b.dsrPay);

  return {
    rows,
    missingCents: rows.filter((r) => r.unit === 'money' && r.status === 'underpaid').reduce((sum, r) => sum - r.diff, 0),
    missingHoursRows: rows.filter((r) => r.unit === 'hours' && r.status === 'underpaid').length,
  };
}
