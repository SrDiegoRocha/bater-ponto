import { HOUR, MINUTE } from './time';
import { clampToBounds, editBounds, isWithinBounds, validateSequence } from './validation';

const t = (iso: string) => new Date(iso).getTime();
const now = t('2026-10-14T18:00:00');

describe('validateSequence', () => {
  it('sequência válida', () => {
    const punches = [
      { kind: 'in' as const, at: t('2026-10-14T08:00:00') },
      { kind: 'out' as const, at: t('2026-10-14T11:00:00') },
    ];
    expect(validateSequence(punches, { now })).toEqual([]);
  });

  it('R1/R2/R3: alternância, ordem e futuro', () => {
    const issues = validateSequence(
      [
        { kind: 'out', at: t('2026-10-14T08:00:00') },
        { kind: 'out', at: t('2026-10-14T07:00:00') },
        { kind: 'in', at: t('2026-10-14T19:00:00') },
      ],
      { now },
    ).map((i) => i.code);
    expect(issues).toEqual(
      expect.arrayContaining(['must-start-with-in', 'not-alternating', 'not-chronological', 'future']),
    );
  });

  it('R3: tolera 1 min de diferença de relógio', () => {
    expect(validateSequence([{ kind: 'in', at: now + 30_000 }], { now })).toEqual([]);
  });

  it('R5: jornada aberta há mais de 24h', () => {
    const issues = validateSequence([{ kind: 'in', at: now - 25 * HOUR }], { now });
    expect(issues).toContainEqual({ code: 'too-long' });
  });
});

describe('editBounds (ED4)', () => {
  const punches = [
    { kind: 'in' as const, at: t('2026-10-14T08:00:00') },
    { kind: 'out' as const, at: t('2026-10-14T11:00:00') },
    { kind: 'in' as const, at: t('2026-10-14T16:00:00') },
  ];

  it('batida do meio fica entre as vizinhas, com 1 min de folga', () => {
    const b = editBounds(punches, 1, { now });
    expect(b.min).toBe(t('2026-10-14T08:01:00'));
    expect(b.max).toBe(t('2026-10-14T15:59:00'));
  });

  it('última batida é limitada por agora', () => {
    expect(editBounds(punches, 2, { now }).max).toBe(now);
  });

  it('primeira batida respeita o fim da jornada anterior', () => {
    const b = editBounds(punches, 0, { now, previousWorkdayEnd: t('2026-10-13T23:00:00') });
    expect(b.min).toBe(t('2026-10-13T23:01:00'));
    expect(editBounds(punches, 0, { now }).min).toBeNull();
  });

  it('última batida respeita o início da próxima jornada', () => {
    const b = editBounds(punches, 2, { now, nextWorkdayStart: t('2026-10-14T17:00:00') });
    expect(b.max).toBe(t('2026-10-14T16:59:00'));
  });

  it('caso 15:45 → 15:43 cabe nos limites; ultrapassar é travado', () => {
    const b = editBounds(punches, 1, { now });
    const corrected = t('2026-10-14T11:00:00') - 2 * MINUTE;
    expect(isWithinBounds(corrected, b)).toBe(true);
    expect(clampToBounds(t('2026-10-14T07:00:00'), b)).toBe(b.min);
    expect(clampToBounds(t('2026-10-14T17:00:00'), b)).toBe(b.max);
  });
});
