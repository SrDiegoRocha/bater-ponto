import { getPeriodContaining } from './period';
import type { WorkdayInput } from './stats';
import { HOUR, MINUTE } from './time';
import { buildCheckDays, buildDiffText, summarizeChecks, type DayCheck } from './timesheet-check';

const t = (iso: string) => new Date(iso).getTime();
const period = getPeriodContaining('2026-10-14', 1); // 01/10 a 31/10
const now = t('2026-10-14T20:00:00');

const workday = (date: string, times: [string, string][], status: WorkdayInput['status'] = 'closed'): WorkdayInput => ({
  id: date,
  refDate: date,
  status,
  note: null,
  punches: times.flatMap(([a, b]) => [
    { kind: 'in' as const, at: t(`${date}T${a}:00`) },
    { kind: 'out' as const, at: t(`${date}T${b}:00`) },
  ]),
});

const workdays = [
  workday('2026-10-01', [['08:00', '12:00'], ['13:00', '17:00']]),
  workday('2026-10-02', [['08:00', '12:00']]),
];

it('lista os dias do período até hoje, com batidas e horas do app', () => {
  const days = buildCheckDays({ period, today: '2026-10-14', workdays, checks: [], now });
  expect(days).toHaveLength(14);
  expect(days[0]).toMatchObject({ date: '2026-10-01', workedMs: 8 * HOUR, incomplete: false, check: null, diffMs: null });
  expect(days[0].punches).toHaveLength(4);
  expect(days[2]).toMatchObject({ date: '2026-10-03', workedMs: 0, punches: [] });
});

it('diferença = espelho − app; "bate" não tem diferença', () => {
  const checks: DayCheck[] = [
    { date: '2026-10-01', status: 'diff', companyWorkedMs: 7 * HOUR + 50 * MINUTE, note: 'saída 17:00 virou 16:50' },
    { date: '2026-10-02', status: 'ok', companyWorkedMs: null, note: null },
  ];
  const days = buildCheckDays({ period, today: '2026-10-14', workdays, checks, now });
  expect(days[0].diffMs).toBe(-10 * MINUTE);
  expect(days[1].diffMs).toBeNull();
  expect(summarizeChecks(days)).toEqual({ total: 14, checked: 2, pending: 12, diffs: 1, diffMs: -10 * MINUTE });
});

it('jornada incompleta marca o dia', () => {
  const days = buildCheckDays({
    period,
    today: '2026-10-05',
    workdays: [workday('2026-10-05', [['08:00', '12:00']], 'incomplete')],
    checks: [],
    now,
  });
  expect(days.at(-1)!.incomplete).toBe(true);
});

it('texto para o RH lista só os dias diferentes', () => {
  const checks: DayCheck[] = [
    { date: '2026-10-01', status: 'diff', companyWorkedMs: 7 * HOUR + 50 * MINUTE, note: 'saída 17:00 virou 16:50' },
    { date: '2026-10-02', status: 'ok', companyWorkedMs: null, note: null },
  ];
  const days = buildCheckDays({ period, today: '2026-10-14', workdays, checks, now });
  const text = buildDiffText(period, days, {
    date: (d) => d,
    time: (at) => new Date(at).toTimeString().slice(0, 5),
    duration: (ms, opts) => `${opts?.signed && ms > 0 ? '+' : ''}${ms / MINUTE}min`,
  });
  expect(text).toContain('• 2026-10-01');
  expect(text).toContain('Meus registros: 08:00–12:00, 13:00–17:00 = 480min');
  expect(text).toContain('Espelho: 470min (-10min)');
  expect(text).toContain('Obs.: saída 17:00 virou 16:50');
  expect(text).not.toContain('2026-10-02');
  expect(text).toContain('Diferença total: -10min');
});
