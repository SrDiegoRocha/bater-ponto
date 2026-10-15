import { HOUR } from './time';
import { lastOccurrence, minuteOfDay, nextOccurrence, parseTypedTime, resolveSequence } from './time-of-day';

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

it('lastOccurrence pega o horário mais recente até agora', () => {
  const now = t('2026-10-14T14:00:00');
  expect(lastOccurrence(now, m(8, 2))).toBe(t('2026-10-14T08:02:00'));
  expect(lastOccurrence(now, m(14))).toBe(now);
  expect(lastOccurrence(now, m(23, 50))).toBe(t('2026-10-13T23:50:00'));
  // dentro da tolerância conta como agora, não como ontem
  expect(lastOccurrence(t('2026-10-14T14:00:30'), m(14, 1), 60_000)).toBe(t('2026-10-14T14:01:00'));
});

it('lastOccurrence logo depois da meia-noite volta para ontem', () => {
  expect(lastOccurrence(t('2026-10-14T00:30:00'), m(23, 50))).toBe(t('2026-10-13T23:50:00'));
});

it('parseTypedTime aceita só HHMM válido', () => {
  expect(parseTypedTime('0802')).toBe(m(8, 2));
  expect(parseTypedTime('2359')).toBe(m(23, 59));
  expect(parseTypedTime('0000')).toBe(0);
  expect(parseTypedTime('2400')).toBeNull();
  expect(parseTypedTime('0860')).toBeNull();
  expect(parseTypedTime('802')).toBeNull();
});
