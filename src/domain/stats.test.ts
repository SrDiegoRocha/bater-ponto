import { holidaysInRange } from './holidays';
import { getPeriodContaining } from './period';
import { computePeriodStats, type WorkdayInput } from './stats';
import { CLT_RULES } from './work-rules';
import { HOUR } from './time';

const t = (iso: string) => new Date(iso).getTime();
const period = getPeriodContaining('2026-10-14', 21); // 21/09 a 20/10

const workdayA: WorkdayInput = {
  id: 'a',
  refDate: '2026-10-12', // feriado (N. Sra. Aparecida)
  status: 'closed',
  note: null,
  punches: [
    { kind: 'in', at: t('2026-10-12T08:00:00') },
    { kind: 'out', at: t('2026-10-12T11:00:00') },
    { kind: 'in', at: t('2026-10-12T16:00:00') },
    { kind: 'out', at: t('2026-10-12T23:00:00') },
  ],
};

const workdayB: WorkdayInput = {
  id: 'b',
  refDate: '2026-10-13',
  status: 'closed',
  note: null,
  punches: [
    { kind: 'in', at: t('2026-10-13T04:00:00') },
    { kind: 'out', at: t('2026-10-13T09:00:00') },
    { kind: 'in', at: t('2026-10-13T17:00:00') },
    { kind: 'out', at: t('2026-10-13T20:00:00') },
    { kind: 'in', at: t('2026-10-13T23:00:00') },
    { kind: 'out', at: t('2026-10-14T02:00:00') },
  ],
};

const broken: WorkdayInput = {
  id: 'c',
  refDate: '2026-10-10',
  status: 'incomplete',
  note: null,
  punches: [{ kind: 'in', at: t('2026-10-10T08:00:00') }],
};

function run() {
  return computePeriodStats({
    period,
    workdays: [workdayA, workdayB, broken],
    dayOffs: [
      { date: '2026-10-11', kind: 'folga', note: null },
      { date: '2026-10-05', kind: 'atestado', note: null },
    ],
    holidays: holidaysInRange(period.start, period.end, []),
    rules: CLT_RULES,
    sundayDouble: true,
    today: '2026-10-14',
    now: t('2026-10-14T12:00:00'),
  });
}

describe('computePeriodStats', () => {
  const s = run();

  it('soma trabalho e intervalo só de jornadas válidas', () => {
    expect(s.workedMs).toBe(21 * HOUR);
    expect(s.breakMs).toBe(16 * HOUR);
    expect(s.daysWorked).toBe(2);
    expect(s.incompleteCount).toBe(1);
  });

  it('conta folgas por tipo e feriado trabalhado', () => {
    expect(s.dayOffs.folga).toBe(1);
    expect(s.dayOffs.atestado).toBe(1);
    expect(s.dayOffTotal).toBe(2);
    expect(s.holidaysWorked).toBe(1);
    expect(s.days.get('2026-10-12')).toMatchObject({ type: 'worked', holiday: { key: 'aparecida' } });
  });

  it('horas noturnas: 1h (04–05) + 1h (22–23 do dia 12) + 3h (23–02)', () => {
    expect(s.nightMs).toBe(5 * HOUR);
  });

  it('interjornada entre 23:00 do dia 12 e 04:00 do dia 13 = 5h (abaixo de 11h)', () => {
    expect(s.minRestMs).toBe(5 * HOUR);
    expect(s.shortRestCount).toBe(1);
  });

  it('maior e menor jornada', () => {
    expect(s.longest).toEqual({ date: '2026-10-13', ms: 11 * HOUR });
    expect(s.shortest).toEqual({ date: '2026-10-12', ms: 10 * HOUR });
  });

  it('horas extras: feriado trabalhado é 100%; dia comum passa das 8h', () => {
    // 12/10 (feriado) 10h a 100%; 13/10 11h → 3h extra
    expect(s.extraDoubleMs).toBe(10 * HOUR);
    expect(s.extraMs).toBe(3 * HOUR);
    expect(s.overtime.get('2026-10-13')).toEqual({ normalMs: 8 * HOUR, extraMs: 3 * HOUR, extraDoubleMs: 0 });
  });

  it('dias sem registro não contam futuro nem hoje', () => {
    expect(s.days.get('2026-10-20')).toEqual({ type: 'future', holiday: null });
    expect(s.days.get('2026-10-14')).toEqual({ type: 'empty' });
    expect(s.daysWithoutRecord).toBe(18);
  });

  it('horário médio de início e fim (fim pode passar de 24h)', () => {
    expect(s.avgStartMinutes).toBe((8 * 60 + 4 * 60) / 2);
    expect(s.avgEndMinutes).toBe((23 * 60 + 26 * 60) / 2);
  });
});
