import { copyShifts, moveToDate } from './copy-workday';
import { HOUR } from './time';

const t = (iso: string) => new Date(iso).getTime();

it('move mantendo o horário e o +1 da madrugada', () => {
  expect(moveToDate(t('2026-10-13T23:00:00'), '2026-10-13', '2026-10-20')).toBe(t('2026-10-20T23:00:00'));
  expect(moveToDate(t('2026-10-14T02:00:00'), '2026-10-13', '2026-10-20')).toBe(t('2026-10-21T02:00:00'));
  expect(moveToDate(t('2026-10-13T08:30:45'), '2026-10-13', '2026-10-01')).toBe(t('2026-10-01T08:30:00'));
});

it('copia o exemplo B para outro dia', () => {
  const punches = [
    { kind: 'in' as const, at: t('2026-10-13T04:00:00') },
    { kind: 'out' as const, at: t('2026-10-13T09:00:00') },
    { kind: 'in' as const, at: t('2026-10-13T17:00:00') },
    { kind: 'out' as const, at: t('2026-10-13T20:00:00') },
    { kind: 'in' as const, at: t('2026-10-13T23:00:00') },
    { kind: 'out' as const, at: t('2026-10-14T02:00:00') },
  ];
  const shifts = copyShifts(punches, '2026-10-13', '2026-10-06')!;
  expect(shifts).toHaveLength(3);
  expect(shifts[0].start).toBe(t('2026-10-06T04:00:00'));
  expect(shifts[2].end).toBe(t('2026-10-07T02:00:00'));
  expect(shifts.reduce((s, x) => s + x.end - x.start, 0)).toBe(11 * HOUR);
});

it('recusa jornada incompleta', () => {
  expect(copyShifts([{ kind: 'in', at: 1 }], '2026-10-13', '2026-10-14')).toBeNull();
  expect(copyShifts([{ kind: 'out', at: 1 }, { kind: 'in', at: 2 }], '2026-10-13', '2026-10-14')).toBeNull();
});
