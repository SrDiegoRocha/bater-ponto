import { dayBalance, DEFAULT_GOAL, goalForDate } from './balance';
import { nightMs } from './night-hours';
import { simpleGrossCents } from './salary';
import { HOUR, MINUTE } from './time';

const t = (iso: string) => new Date(iso).getTime();

describe('meta diária e saldo', () => {
  it('padrão de 8h', () => {
    expect(goalForDate('2026-10-14', DEFAULT_GOAL)).toBe(8 * HOUR);
  });
  it('meta por dia da semana (sábado 4h)', () => {
    expect(goalForDate('2026-10-17', { defaultMinutes: 480, byWeekday: { 6: 240 } })).toBe(4 * HOUR);
  });
  it('folga/feriado → meta 0', () => {
    expect(goalForDate('2026-10-12', DEFAULT_GOAL, { isNonWorkingDay: true })).toBe(0);
  });
  it('saldo positivo e negativo', () => {
    expect(dayBalance(10 * HOUR, 8 * HOUR)).toBe(2 * HOUR);
    expect(dayBalance(7 * HOUR, 8 * HOUR)).toBe(-HOUR);
  });
});

describe('horas noturnas (22h–5h)', () => {
  it('turno 23h → 02h é todo noturno', () => {
    expect(nightMs({ start: t('2026-10-13T23:00:00'), end: t('2026-10-14T02:00:00') })).toBe(3 * HOUR);
  });
  it('turno 04h → 09h tem 1h noturna', () => {
    expect(nightMs({ start: t('2026-10-13T04:00:00'), end: t('2026-10-13T09:00:00') })).toBe(HOUR);
  });
  it('turno 20h → 23h30 tem 1h30 noturna', () => {
    expect(nightMs({ start: t('2026-10-13T20:00:00'), end: t('2026-10-13T23:30:00') })).toBe(90 * MINUTE);
  });
  it('turno diurno não tem hora noturna', () => {
    expect(nightMs({ start: t('2026-10-13T08:00:00'), end: t('2026-10-13T18:00:00') })).toBe(0);
  });
  it('turno longo pega duas janelas', () => {
    expect(nightMs({ start: t('2026-10-13T21:00:00'), end: t('2026-10-15T01:00:00') })).toBe(10 * HOUR);
  });
});

describe('salário simples', () => {
  it('horas × valor', () => {
    expect(simpleGrossCents(160 * HOUR, 25.5)).toBe(408000);
    expect(simpleGrossCents(90 * MINUTE, 20)).toBe(3000);
  });
  it('sem valor/hora → 0', () => {
    expect(simpleGrossCents(10 * HOUR, 0)).toBe(0);
  });
});

it('meta por dia da semana continua funcionando depois de salva em JSON (chaves viram texto)', () => {
  const stored = JSON.parse(JSON.stringify({ defaultMinutes: 480, byWeekday: { 6: 240, 0: 0 } }));
  expect(goalForDate('2026-10-17', stored)).toBe(4 * HOUR); // sábado
  expect(goalForDate('2026-10-18', stored)).toBe(0); // domingo
  expect(goalForDate('2026-10-19', stored)).toBe(8 * HOUR); // segunda
});
