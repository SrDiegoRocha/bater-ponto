import { DEFAULT_REMINDERS, planReminders, weekdaysFromDates } from './reminders';
import { HOUR, MINUTE } from './time';

const t = (iso: string) => new Date(iso).getTime();
const on = { ...DEFAULT_REMINDERS, enabled: true };

// Quarta, 14/10/2026
const base = {
  now: t('2026-10-14T10:00:00'),
  settings: on,
  dailyLimitMs: 8 * HOUR,
  openPunches: null,
  openWorkedMs: 0,
  recordedDates: new Set<string>(),
  skipDates: new Set<string>(),
  workWeekdays: new Set<number>(),
};

it('desligado não agenda nada', () => {
  expect(planReminders({ ...base, settings: DEFAULT_REMINDERS })).toEqual([]);
});

it('trabalhando: avisa 15 min depois de passar do limite', () => {
  const plan = planReminders({
    ...base,
    openPunches: [{ kind: 'in', at: t('2026-10-14T04:30:00') }],
    openWorkedMs: 5 * HOUR,
    settings: { ...on, endOfDay: false },
  });
  expect(plan).toHaveLength(1);
  expect(plan[0]).toMatchObject({ id: 'lembrete-limite', href: '/bater' });
  expect(plan[0].at).toBe(base.now + 3 * HOUR + 15 * MINUTE);
});

it('trabalhando e já bem acima do limite: não insiste', () => {
  const plan = planReminders({
    ...base,
    openPunches: [{ kind: 'in', at: t('2026-10-14T00:00:00') }],
    openWorkedMs: 10 * HOUR,
    settings: { ...on, endOfDay: false },
  });
  expect(plan).toEqual([]);
});

it('em intervalo: avisa depois do tempo configurado; o intervalo de 2h40 não dispara antes de 3h', () => {
  const lastOut = t('2026-10-14T09:50:00');
  const plan = planReminders({
    ...base,
    openPunches: [
      { kind: 'in', at: t('2026-10-14T04:30:00') },
      { kind: 'out', at: lastOut },
    ],
    settings: { ...on, endOfDay: false },
  });
  expect(plan).toEqual([expect.objectContaining({ id: 'lembrete-intervalo', at: lastOut + 3 * HOUR })]);
});

it('fim do dia: só em dias sem anotação, nos dias da semana em que costuma trabalhar, fora folgas', () => {
  const plan = planReminders({
    ...base,
    recordedDates: new Set(['2026-10-15']), // quinta já anotada
    skipDates: new Set(['2026-10-16']), // sexta de folga
    workWeekdays: new Set([1, 2, 3, 4, 5, 6]), // nunca trabalha domingo
  });
  expect(plan.map((p) => p.id)).toEqual([
    'lembrete-dia-2026-10-14', // hoje (quarta)
    'lembrete-dia-2026-10-17', // sábado
    'lembrete-dia-2026-10-19', // segunda (domingo 18 pulado)
    'lembrete-dia-2026-10-20',
  ]);
  expect(plan[0].at).toBe(t('2026-10-14T21:00:00'));
});

it('fim do dia: hoje com jornada aberta não repete aviso; depois do horário, começa amanhã', () => {
  const open = planReminders({
    ...base,
    openPunches: [{ kind: 'in', at: t('2026-10-14T08:00:00') }],
    openWorkedMs: 2 * HOUR,
    settings: { ...on, overLimit: false },
  });
  expect(open.map((p) => p.id)).not.toContain('lembrete-dia-2026-10-14');

  const late = planReminders({ ...base, now: t('2026-10-14T22:00:00') });
  expect(late[0].id).toBe('lembrete-dia-2026-10-15');
});

it('usuário novo: todos os dias menos domingo', () => {
  const plan = planReminders(base);
  expect(plan.map((p) => p.id)).not.toContain('lembrete-dia-2026-10-18');
  expect(plan).toHaveLength(6);
});

it('weekdaysFromDates', () => {
  expect(weekdaysFromDates(['2026-10-12', '2026-10-18', '2026-10-19'])).toEqual(new Set([1, 0]));
});
