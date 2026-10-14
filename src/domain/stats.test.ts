import { DEFAULT_GOAL } from './balance';
import { holidaysInRange } from './holidays';
import { getPeriodContaining } from './period';
import { computePeriodStats, type WorkdayInput } from './stats';
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
    goal: DEFAULT_GOAL,
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

  it('banco de horas: feriado trabalhado vale tudo como crédito; dias vazios contam débito', () => {
    // dias 21/09..13/10 = 23 dias passados. Úteis sem registro: 23 − 2 folgas − 1 feriado trabalhado − 1 dia 13 = 19
    // Dia 10 (incompleto) também é débito. Saldo = 10h (feriado, meta 0) + (11h − 8h) − 19 × 8h
    expect(s.balanceMs).toBe(10 * HOUR + 3 * HOUR - 19 * 8 * HOUR);
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
