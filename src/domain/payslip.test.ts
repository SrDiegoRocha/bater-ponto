import type { CltBreakdown } from './clt';
import { comparePayslip, EMPTY_PAYSLIP, formatHoursInput, parseHours } from './payslip';
import { HOUR, MINUTE } from './time';

const pcts = { overtimePct: 50, holidayOvertimePct: 100 };

const breakdown = (patch: Partial<CltBreakdown>): CltBreakdown => ({
  normalMs: 0,
  extraMs: 0,
  extraDoubleMs: 0,
  nightMs: 0,
  nightBonusMs: 0,
  businessDays: 25,
  restDays: 5,
  normalPay: 0,
  extraPay: 0,
  extraDoublePay: 0,
  nightBonusPay: 0,
  nightAdditionalPay: 0,
  dsrPay: 0,
  gross: 0,
  inss: 0,
  irrf: 0,
  net: 0,
  ...patch,
});

describe('parseHours', () => {
  it('decimal: 12,50 = 12h30', () => {
    expect(parseHours('12,50', 'decimal')).toBe(12 * HOUR + 30 * MINUTE);
    expect(parseHours('12.5', 'decimal')).toBe(12 * HOUR + 30 * MINUTE);
    expect(parseHours('8', 'decimal')).toBe(8 * HOUR);
    expect(parseHours('1,25', 'decimal')).toBe(HOUR + 15 * MINUTE);
  });

  it('relógio: 12:30, 12,30, 12h30', () => {
    expect(parseHours('12:30', 'clock')).toBe(12 * HOUR + 30 * MINUTE);
    expect(parseHours('12,30', 'clock')).toBe(12 * HOUR + 30 * MINUTE);
    expect(parseHours('12h30', 'clock')).toBe(12 * HOUR + 30 * MINUTE);
    expect(parseHours('12', 'clock')).toBe(12 * HOUR);
    expect(parseHours('3:5', 'clock')).toBe(3 * HOUR + 50 * MINUTE);
  });

  it('vazio e inválido viram null', () => {
    expect(parseHours('', 'decimal')).toBeNull();
    expect(parseHours('  ', 'clock')).toBeNull();
    expect(parseHours('abc', 'decimal')).toBeNull();
    expect(parseHours('12:75', 'clock')).toBeNull();
    expect(parseHours('12:30', 'decimal')).toBeNull();
  });

  it('formatHoursInput é o inverso', () => {
    const ms = 12 * HOUR + 30 * MINUTE;
    expect(formatHoursInput(ms, 'decimal')).toBe('12,5');
    expect(formatHoursInput(ms, 'clock')).toBe('12:30');
    expect(parseHours(formatHoursInput(ms, 'decimal'), 'decimal')).toBe(ms);
    expect(formatHoursInput(null, 'clock')).toBe('');
  });
});

describe('comparePayslip', () => {
  it('ignora campos não informados', () => {
    expect(comparePayslip(EMPTY_PAYSLIP, breakdown({ extraMs: 10 * HOUR }), pcts).rows).toEqual([]);
  });

  it('aponta extras pagas a menos, em horas e em R$', () => {
    const b = breakdown({ extraMs: 12 * HOUR, extraPay: 36000 });
    const check = comparePayslip({ ...EMPTY_PAYSLIP, extraMs: 8 * HOUR, extraCents: 24000 }, b, pcts);
    expect(check.rows.map((r) => [r.key, r.status, r.diff])).toEqual([
      ['extraHours', 'underpaid', -4 * HOUR],
      ['extraValue', 'underpaid', -12000],
    ]);
    expect(check.missingCents).toBe(12000);
    expect(check.missingHoursRows).toBe(1);
  });

  it('diferenças de arredondamento contam como certo', () => {
    const b = breakdown({ extraMs: 10 * HOUR + 3 * MINUTE, dsrPay: 5050 });
    const check = comparePayslip({ ...EMPTY_PAYSLIP, extraMs: 10 * HOUR, dsrCents: 5000 }, b, pcts);
    expect(check.rows.every((r) => r.status === 'ok')).toBe(true);
    expect(check.missingCents).toBe(0);
  });

  it('pagou a mais não entra no que falta', () => {
    const check = comparePayslip({ ...EMPTY_PAYSLIP, dsrCents: 9000 }, breakdown({ dsrPay: 5000 }), pcts);
    expect(check.rows[0].status).toBe('overpaid');
    expect(check.missingCents).toBe(0);
  });

  it('horas noturnas comparadas já com a hora reduzida', () => {
    const b = breakdown({ nightMs: 7 * HOUR, nightBonusMs: HOUR });
    const check = comparePayslip({ ...EMPTY_PAYSLIP, nightMs: 8 * HOUR }, b, pcts);
    expect(check.rows[0]).toMatchObject({ key: 'nightHours', status: 'ok', expected: 8 * HOUR });
  });

  it('rótulos usam os percentuais configurados', () => {
    const check = comparePayslip({ ...EMPTY_PAYSLIP, extraMs: 0, extraDoubleMs: 0 }, breakdown({}), {
      overtimePct: 60,
      holidayOvertimePct: 100,
    });
    expect(check.rows.map((r) => r.label)).toEqual(['Horas extras 60%', 'Horas extras 100%']);
  });
});
