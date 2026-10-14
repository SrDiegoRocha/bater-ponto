import {
  getPeriodContaining,
  periodContains,
  periodDates,
  periodLabel,
  periodRangeLabel,
  resolveStartDay,
  shiftPeriod,
} from './period';

describe('período com início no dia 21 (Q1: 21/09 a 20/10)', () => {
  it('dia 14/10 cai no período Setembro (21/09–20/10)', () => {
    const p = getPeriodContaining('2026-10-14', 21);
    expect(p).toMatchObject({ start: '2026-09-21', end: '2026-10-20', year: 2026, month: 8 });
    expect(periodLabel(p)).toBe('Setembro 2026');
    expect(periodRangeLabel(p)).toBe('21/09 a 20/10');
  });

  it('o dia 21 já abre o próximo período', () => {
    expect(getPeriodContaining('2026-10-21', 21).start).toBe('2026-10-21');
    expect(getPeriodContaining('2026-10-20', 21).start).toBe('2026-09-21');
  });

  it('atravessa a virada do ano', () => {
    const p = getPeriodContaining('2027-01-05', 21);
    expect(p).toMatchObject({ start: '2026-12-21', end: '2027-01-20' });
    expect(periodLabel(p)).toBe('Dezembro 2026');
  });

  it('navega entre períodos', () => {
    const p = getPeriodContaining('2026-10-14', 21);
    expect(shiftPeriod(p, 1, 21)).toMatchObject({ start: '2026-10-21', end: '2026-11-20' });
    expect(shiftPeriod(p, -9, 21)).toMatchObject({ start: '2025-12-21', end: '2026-01-20' });
  });

  it('lista todas as datas, inclusive', () => {
    const dates = periodDates(getPeriodContaining('2026-10-14', 21));
    expect(dates[0]).toBe('2026-09-21');
    expect(dates.at(-1)).toBe('2026-10-20');
    expect(dates).toHaveLength(30);
    expect(periodContains(getPeriodContaining('2026-10-14', 21), '2026-10-20')).toBe(true);
  });
});

describe('P1: dia de início 29–31', () => {
  it('31 vira o último dia em meses curtos', () => {
    expect(resolveStartDay(31, 2026, 1)).toBe(28); // fev/2026
    expect(resolveStartDay(31, 2028, 1)).toBe(29); // fev/2028 bissexto
    expect(resolveStartDay(31, 2026, 3)).toBe(30); // abril
  });

  it('períodos com início 31 não deixam buracos nem sobreposição', () => {
    const fev = getPeriodContaining('2026-03-01', 31);
    expect(fev).toMatchObject({ start: '2026-02-28', end: '2026-03-30' });
    expect(shiftPeriod(fev, 1, 31).start).toBe('2026-03-31');
    expect(shiftPeriod(fev, -1, 31).end).toBe('2026-02-27');
  });

  it('início no dia 1 = mês civil', () => {
    expect(getPeriodContaining('2026-02-14', 1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
  });
});
