import { describeTemplate, shiftsFromPunches, templateToShifts } from './templates';

const t = (iso: string) => new Date(iso).getTime();
const m = (h: number, min = 0) => h * 60 + min;

const escalaB = { shifts: [{ start: m(4), end: m(9) }, { start: m(17), end: m(20) }, { start: m(23), end: m(2) }] };

it('aplica a escala numa data, com madrugada no dia seguinte', () => {
  const shifts = templateToShifts(escalaB, '2026-10-20');
  expect(shifts[0]).toEqual({ start: t('2026-10-20T04:00:00'), end: t('2026-10-20T09:00:00') });
  expect(shifts[2]).toEqual({ start: t('2026-10-20T23:00:00'), end: t('2026-10-21T02:00:00') });
});

it('descreve a escala', () => {
  expect(describeTemplate(escalaB)).toBe('04:00–09:00 · 17:00–20:00 · 23:00–02:00');
});

it('cria escala a partir de uma jornada', () => {
  expect(
    shiftsFromPunches([
      { kind: 'in', at: t('2026-10-13T08:00:00') },
      { kind: 'out', at: t('2026-10-13T11:00:00') },
    ]),
  ).toEqual([{ start: m(8), end: m(11) }]);
  expect(shiftsFromPunches([{ kind: 'in', at: 1 }])).toBeNull();
});
