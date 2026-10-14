import { DEFAULT_GOAL } from './balance';
import { computeCltPay, type CltConfig } from './clt';
import { holidaysInRange } from './holidays';
import { getPeriodContaining } from './period';
import type { WorkdayInput } from './stats';
import { inss, irrf } from './tax-2026';
import { HOUR } from './time';

const t = (iso: string) => new Date(iso).getTime();

describe('INSS 2026', () => {
  it.each([
    [1000, 75],
    [1621, 121.58],
    [3000, 248.6],
    [8475.55, 988.09],
    [20000, 988.09],
  ])('salário %d → %d', (gross, expected) => expect(inss(gross)).toBe(expected));
});

describe('IRRF 2026', () => {
  it('isento até R$ 5.000', () => {
    expect(irrf(5000, inss(5000))).toBe(0);
    expect(irrf(3000, inss(3000))).toBe(0);
  });
  it('redutor parcial entre R$ 5.000,01 e R$ 7.350', () => {
    // base = 6000 − 607,20 (simplificado > INSS 641,51? não: INSS 641,51 é maior) → usa INSS
    const i = inss(6000);
    expect(i).toBe(641.51);
    const base = 6000 - i; // 5358,49
    const tax = base * 0.275 - 908.73;
    const reduction = 978.62 - 0.133145 * 6000;
    expect(irrf(6000, i)).toBeCloseTo(Math.round((tax - reduction) * 100) / 100, 2);
  });
  it('sem redutor acima de R$ 7.350', () => {
    const i = inss(10000);
    expect(irrf(10000, i)).toBeCloseTo((10000 - i) * 0.275 - 908.73, 2);
  });
  it('dependentes reduzem a base', () => {
    const i = inss(9000);
    expect(irrf(9000, i, 2)).toBeLessThan(irrf(9000, i, 0));
  });
});

describe('computeCltPay', () => {
  const period = getPeriodContaining('2026-10-14', 21);
  const holidays = holidaysInRange(period.start, period.end, []);
  const config: CltConfig = {
    hourlyRate: 20,
    goal: DEFAULT_GOAL,
    overtimePct: 50,
    holidayOvertimePct: 100,
    nightPct: 20,
    nightReduced: false,
    dsrOnExtras: false,
    sundayDouble: true,
    dependents: 0,
  };
  const day = (id: string, refDate: string, pairs: [string, string][]): WorkdayInput => ({
    id,
    refDate,
    status: 'closed',
    note: null,
    punches: pairs.flatMap(([a, b]) => [
      { kind: 'in' as const, at: t(a) },
      { kind: 'out' as const, at: t(b) },
    ]),
  });

  const workdays = [
    day('a', '2026-10-13', [['2026-10-13T08:00:00', '2026-10-13T18:00:00']]), // ter: 10h → 8 normais + 2 extras
    day('b', '2026-10-12', [['2026-10-12T08:00:00', '2026-10-12T12:00:00']]), // feriado: 4h a 100%
    day('c', '2026-10-11', [['2026-10-11T08:00:00', '2026-10-11T10:00:00']]), // domingo: 2h a 100%
    day('d', '2026-10-14', [['2026-10-14T20:00:00', '2026-10-15T00:00:00']]), // qua: 4h, 2h noturnas
  ];

  it('separa normais, extras 50% e 100% e calcula valores', () => {
    const r = computeCltPay({ period, workdays, dayOffs: [], holidays, config, now: t('2026-10-15T12:00:00') });
    expect(r.normalMs).toBe(12 * HOUR);
    expect(r.extraMs).toBe(2 * HOUR);
    expect(r.extraDoubleMs).toBe(6 * HOUR);
    expect(r.nightMs).toBe(2 * HOUR);
    expect(r.normalPay).toBe(12 * 20 * 100);
    expect(r.extraPay).toBe(2 * 30 * 100);
    expect(r.extraDoublePay).toBe(6 * 40 * 100);
    expect(r.nightAdditionalPay).toBe(2 * 4 * 100);
    expect(r.gross).toBe(24000 + 6000 + 24000 + 800);
    expect(r.net).toBe(r.gross - r.inss - r.irrf);
  });

  it('hora noturna reduzida acrescenta horas fictas', () => {
    const r = computeCltPay({ period, workdays, dayOffs: [], holidays, config: { ...config, nightReduced: true }, now: t('2026-10-15T12:00:00') });
    expect(r.nightBonusMs).toBeCloseTo((2 * HOUR * 60) / 52.5 - 2 * HOUR, 0);
    expect(r.nightBonusPay).toBeGreaterThan(0);
  });

  it('DSR sobre extras usa dias úteis e de descanso do período', () => {
    const r = computeCltPay({ period, workdays, dayOffs: [], holidays, config: { ...config, dsrOnExtras: true }, now: t('2026-10-15T12:00:00') });
    // 21/09–20/10: 30 dias, 4 domingos + 1 feriado (12/10, segunda) = 5 de descanso, 25 úteis
    expect(r.restDays).toBe(5);
    expect(r.businessDays).toBe(25);
    expect(r.dsrPay).toBe(Math.round(((6000 + 24000) / 25) * 5));
  });

  it('simulador soma horas extras', () => {
    const base = computeCltPay({ period, workdays, dayOffs: [], holidays, config, now: t('2026-10-15T12:00:00') });
    const sim = computeCltPay({ period, workdays, dayOffs: [], holidays, config, now: t('2026-10-15T12:00:00'), extraSimulatedMs: 10 * HOUR });
    expect(sim.extraPay - base.extraPay).toBe(10 * 30 * 100);
  });
});
