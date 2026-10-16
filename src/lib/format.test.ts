import { HOUR, MINUTE } from '@/domain/time';

import { formatClock, formatDayRange, formatDuration, formatLongDay, formatMoney, formatShortDate, formatWeekdayShort } from './format';

describe('formatDuration', () => {
  it.each([
    [5 * HOUR + 42 * MINUTE, '5h 42min'],
    [5 * HOUR + 2 * MINUTE, '5h 02min'],
    [42 * MINUTE, '42min'],
    [8 * HOUR, '8h'],
    [0, '0min'],
    [59_999, '0min'],
  ])('%d ms → %s', (ms, expected) => expect(formatDuration(ms)).toBe(expected));

  it('saldos levam sinal', () => {
    expect(formatDuration(70 * MINUTE, { signed: true })).toBe('+1h 10min');
    expect(formatDuration(-25 * MINUTE, { signed: true })).toBe('−25min');
    expect(formatDuration(0, { signed: true })).toBe('0min');
  });
});

it('formatClock passa de 24h e mostra segundos opcionais', () => {
  expect(formatClock(26 * HOUR + 5 * MINUTE)).toBe('26:05');
  expect(formatClock(5 * HOUR + 42 * MINUTE + 17_000, { seconds: true })).toBe('05:42:17');
});

it('formatMoney', () => {
  expect(formatMoney(123456)).toBe('R$ 1.234,56');
  expect(formatMoney(5)).toBe('R$ 0,05');
  expect(formatMoney(100000000)).toBe('R$ 1.000.000,00');
  expect(formatMoney(-1050)).toBe('−R$ 10,50');
});

it('datas em pt-BR', () => {
  expect(formatShortDate('2026-10-14')).toBe('qua, 14 out');
  expect(formatLongDay('2026-10-13')).toBe('Terça, 13 out');
});

describe('formatos curtos', () => {
  it('dia da semana com 3 letras', () => {
    expect(formatWeekdayShort('2026-10-12')).toBe('seg');
    expect(formatWeekdayShort('2026-10-17')).toBe('sáb');
  });

  it('intervalo de dias compacto', () => {
    expect(formatDayRange('2026-10-12', '2026-10-18')).toBe('12–18 out');
    expect(formatDayRange('2026-09-28', '2026-10-04')).toBe('28 set – 4 out');
  });
});
