import { DEFAULT_GOAL } from './balance';
import { filterWorkdays } from './history-filter';
import { holidaysInRange } from './holidays';
import type { WorkdayInput } from './stats';
import { summarizeWorkday } from './workday';

const t = (iso: string) => new Date(iso).getTime();
const w = (id: string, refDate: string, a: string, b: string, status: WorkdayInput['status'] = 'closed'): WorkdayInput => ({
  id,
  refDate,
  status,
  note: null,
  punches: [
    { kind: 'in', at: t(a) },
    { kind: 'out', at: t(b) },
  ],
});

const list = [
  w('long', '2026-10-13', '2026-10-13T08:00:00', '2026-10-13T18:00:00'), // 10h → extra
  w('short', '2026-10-14', '2026-10-14T08:00:00', '2026-10-14T12:00:00'), // 4h
  w('holiday', '2026-10-12', '2026-10-12T08:00:00', '2026-10-12T10:00:00'), // feriado → tudo extra
  w('night', '2026-10-15', '2026-10-15T21:00:00', '2026-10-16T01:00:00'),
  w('broken', '2026-10-16', '2026-10-16T08:00:00', '2026-10-16T09:00:00', 'incomplete'),
];
const ctx = {
  summaries: new Map(list.map((x) => [x.id, summarizeWorkday(x.punches)])),
  holidays: holidaysInRange('2026-10-01', '2026-10-31', []),
  dayOffs: [],
  goal: DEFAULT_GOAL,
};
const ids = (f: Parameters<typeof filterWorkdays>[1]) => filterWorkdays(list, f, ctx).map((x) => x.id);

it('filtra por hora extra, incompletas, feriado e noturno', () => {
  expect(ids('all')).toHaveLength(5);
  expect(ids('overtime')).toEqual(['long', 'holiday']);
  expect(ids('incomplete')).toEqual(['broken']);
  expect(ids('holiday')).toEqual(['holiday']);
  expect(ids('night')).toEqual(['night']);
});
