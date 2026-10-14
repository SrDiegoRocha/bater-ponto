import { DEFAULT_GOAL } from '@/domain/balance';
import { holidaysInRange } from '@/domain/holidays';
import { getPeriodContaining } from '@/domain/period';
import { computePeriodStats } from '@/domain/stats';
import type { Punch } from '@/domain/types';

import { buildTimesheetHtml } from './timesheet-html';

const t = (iso: string) => new Date(iso).getTime();
const punch = (id: string, kind: 'in' | 'out', iso: string, originalAt: number | null = null): Punch => ({
  id,
  workdayId: 'w',
  kind,
  at: t(iso),
  tz: 'America/Sao_Paulo',
  isDayStart: false,
  isDayEnd: false,
  originalAt,
  source: 'live',
});

it('monta o espelho com batidas, +1, editadas, folgas, feriados e escapa HTML', () => {
  const period = getPeriodContaining('2026-10-14', 21);
  const holidays = holidaysInRange(period.start, period.end, []);
  const workdays = [
    {
      id: 'w',
      refDate: '2026-10-13',
      status: 'closed' as const,
      note: '<b>cobri</b>',
      punches: [
        punch('1', 'in', '2026-10-13T23:00:00'),
        punch('2', 'out', '2026-10-14T02:00:00', t('2026-10-14T02:05:00')),
      ],
    },
  ];
  const dayOffs = [{ date: '2026-10-11', kind: 'folga' as const, note: null }];
  const stats = computePeriodStats({ period, workdays, dayOffs, holidays, goal: DEFAULT_GOAL, today: '2026-10-14', now: t('2026-10-14T12:00:00') });

  const html = buildTimesheetHtml({
    period,
    stats,
    workdays,
    dayOffs,
    holidays,
    goal: DEFAULT_GOAL,
    userName: 'Diego',
    generatedAt: t('2026-10-14T12:00:00'),
    salary: { mode: 'simple', hourlyRate: 20, grossCents: 6000 },
  });

  expect(html).toContain('Espelho de ponto · Setembro 2026');
  expect(html).toContain('23:00');
  expect(html).toContain('02:00<sup>+1</sup>*');
  expect(html).toContain('Folga');
  expect(html).toContain('Feriado · Nossa Senhora Aparecida');
  expect(html).toContain('&lt;b&gt;cobri&lt;/b&gt;');
  expect(html).not.toContain('<b>cobri</b>');
  expect(html).toContain('R$ 60,00');
  expect((html.match(/<tr/g) ?? []).length).toBe(31); // cabeçalho + 30 dias
});
