import { nightMs } from './night-hours';
import { simpleGrossCents } from './salary';
import { HOUR, MINUTE } from './time';

const t = (iso: string) => new Date(iso).getTime();

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
