import { HOUR, MINUTE } from './time';
import { summarizeWorkday } from './workday';

const t = (iso: string) => new Date(iso).getTime();

describe('summarizeWorkday', () => {
  it('exemplo A: 08–11 e 16–23 → 10h de trabalho, 5h de intervalo, 15h de amplitude', () => {
    const s = summarizeWorkday([
      { kind: 'in', at: t('2026-10-13T08:00:00') },
      { kind: 'out', at: t('2026-10-13T11:00:00') },
      { kind: 'in', at: t('2026-10-13T16:00:00') },
      { kind: 'out', at: t('2026-10-13T23:00:00') },
    ]);
    expect(s.workedMs).toBe(10 * HOUR);
    expect(s.breakMs).toBe(5 * HOUR);
    expect(s.span!.end - s.span!.start).toBe(15 * HOUR);
    expect(s.isOpen).toBe(false);
    expect(s.isConsistent).toBe(true);
  });

  it('exemplo B: 04–09, 17–20, 23–02(+1) → 11h de trabalho, 11h de intervalo, 22h de amplitude', () => {
    const s = summarizeWorkday([
      { kind: 'in', at: t('2026-10-13T04:00:00') },
      { kind: 'out', at: t('2026-10-13T09:00:00') },
      { kind: 'in', at: t('2026-10-13T17:00:00') },
      { kind: 'out', at: t('2026-10-13T20:00:00') },
      { kind: 'in', at: t('2026-10-13T23:00:00') },
      { kind: 'out', at: t('2026-10-14T02:00:00') },
    ]);
    expect(s.workedMs).toBe(11 * HOUR);
    expect(s.breakMs).toBe(11 * HOUR);
    expect(s.breaks).toHaveLength(2);
    expect(s.span!.end - s.span!.start).toBe(22 * HOUR);
  });

  it('jornada aberta conta até agora', () => {
    const s = summarizeWorkday(
      [
        { kind: 'in', at: t('2026-10-14T04:00:00') },
        { kind: 'out', at: t('2026-10-14T09:00:00') },
        { kind: 'in', at: t('2026-10-14T17:00:00') },
      ],
      t('2026-10-14T17:42:00'),
    );
    expect(s.isOpen).toBe(true);
    expect(s.segments.at(-1)!.open).toBe(true);
    expect(s.workedMs).toBe(5 * HOUR + 42 * MINUTE);
  });

  it('ordena as batidas antes de calcular', () => {
    const s = summarizeWorkday([
      { kind: 'out', at: t('2026-10-13T11:00:00') },
      { kind: 'in', at: t('2026-10-13T08:00:00') },
    ]);
    expect(s.workedMs).toBe(3 * HOUR);
  });

  it('sinaliza batidas que não alternam', () => {
    const s = summarizeWorkday([
      { kind: 'in', at: t('2026-10-13T08:00:00') },
      { kind: 'in', at: t('2026-10-13T09:00:00') },
      { kind: 'out', at: t('2026-10-13T10:00:00') },
    ]);
    expect(s.isConsistent).toBe(false);
  });

  it('sem batidas', () => {
    const s = summarizeWorkday([]);
    expect(s.workedMs).toBe(0);
    expect(s.span).toBeNull();
  });
});
