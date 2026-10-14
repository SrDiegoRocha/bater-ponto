import { HOUR } from './time';
import { minuteOfDay, nextOccurrence, resolveSequence } from './time-of-day';

const t = (iso: string) => new Date(iso).getTime();
const m = (h: number, min = 0) => h * 60 + min;

it('minuteOfDay', () => {
  expect(minuteOfDay(t('2026-10-13T15:43:20'))).toBe(m(15, 43));
});

it('nextOccurrence vai para o dia seguinte quando o horário já passou', () => {
  expect(nextOccurrence(t('2026-10-13T23:00:00'), m(2))).toBe(t('2026-10-14T02:00:00'));
  expect(nextOccurrence(t('2026-10-13T01:00:00'), m(2))).toBe(t('2026-10-13T02:00:00'));
  expect(nextOccurrence(t('2026-10-13T02:00:00'), m(2))).toBe(t('2026-10-14T02:00:00'));
  expect(nextOccurrence(t('2026-10-13T02:00:00'), m(2), { inclusive: true })).toBe(t('2026-10-13T02:00:00'));
});

it('resolveSequence monta o exemplo B a partir da data', () => {
  const at = resolveSequence(t('2026-10-13T00:00:00'), [m(4), m(9), m(17), m(20), m(23), m(2)]);
  expect(at[0]).toBe(t('2026-10-13T04:00:00'));
  expect(at[5]).toBe(t('2026-10-14T02:00:00'));
  expect(at[5] - at[0]).toBe(22 * HOUR);
});

it('resolveSequence aceita o primeiro horário à meia-noite', () => {
  expect(resolveSequence(t('2026-10-13T00:00:00'), [m(0), m(8)])).toEqual([t('2026-10-13T00:00:00'), t('2026-10-13T08:00:00')]);
});
