import type { Holiday } from './holidays';
import { nightMs } from './night-hours';
import { periodDates, type Period } from './period';
import { fromDateKey, MINUTE } from './time';
import { summarizeWorkday, type WorkdaySummary } from './workday';
import { MIN_REST_MS } from './validation';
import { buildDayHours, classifyHours, sumOvertime, type DayHours, type DayOvertime, type WorkRules } from './work-rules';
import type { DateKey, DayOff, DayOffKind, Punch, Workday } from './types';

// Indicadores do período (PLANEJAMENTO.md §4).

export type WorkdayInput = Workday & { punches: Pick<Punch, 'kind' | 'at'>[] };

export type DayStatus =
  | { type: 'worked'; workdayIds: string[]; workedMs: number; holiday: Holiday | null; incomplete: boolean }
  | { type: 'dayOff'; kind: DayOffKind }
  | { type: 'holiday'; holiday: Holiday }
  | { type: 'empty' }
  | { type: 'future'; holiday: Holiday | null };

export type PeriodStats = {
  workedMs: number;
  breakMs: number;
  nightMs: number;
  daysWorked: number;
  dayOffs: Record<DayOffKind, number>;
  dayOffTotal: number;
  holidaysOff: number;
  holidaysWorked: number;
  /** Horas extras pelas regras da jornada (limite diário/semanal) */
  extraMs: number;
  /** Horas em feriado, folga ou domingo (extra 100%) */
  extraDoubleMs: number;
  /** Classificação de cada dia trabalhado do período */
  overtime: Map<DateKey, DayOvertime>;
  avgWorkedPerDayMs: number;
  avgBreakPerDayMs: number;
  longest: { date: DateKey; ms: number } | null;
  shortest: { date: DateKey; ms: number } | null;
  /** Minutos desde a meia-noite da data de referência (pode passar de 1440 quando termina no dia seguinte) */
  avgStartMinutes: number | null;
  avgEndMinutes: number | null;
  minRestMs: number | null;
  shortRestCount: number;
  daysWithoutRecord: number;
  incompleteCount: number;
  days: Map<DateKey, DayStatus>;
  summaries: Map<string, WorkdaySummary>;
};

type Input = {
  period: Period;
  workdays: readonly WorkdayInput[];
  dayOffs: readonly DayOff[];
  holidays: ReadonlyMap<DateKey, Holiday>;
  rules: WorkRules;
  /** Domingo trabalhado conta como extra 100% */
  sundayDouble: boolean;
  /** Dias da mesma semana antes do período (fecham o limite semanal) */
  leadDays?: readonly DayHours[];
  today: DateKey;
  now: number;
};

const minutesFromRefDate = (refDate: DateKey, at: number) => (at - fromDateKey(refDate).getTime()) / MINUTE;
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function computePeriodStats({ period, workdays, dayOffs, holidays, rules, sundayDouble, leadDays = [], today, now }: Input): PeriodStats {
  const dayOffByDate = new Map(dayOffs.map((d) => [d.date, d]));
  const summaries = new Map<string, WorkdaySummary>();
  const byDate = new Map<DateKey, WorkdayInput[]>();

  for (const w of workdays) {
    summaries.set(w.id, summarizeWorkday(w.punches, now));
    const list = byDate.get(w.refDate) ?? [];
    list.push(w);
    byDate.set(w.refDate, list);
  }

  // Jornada incompleta fica fora dos totais até ser corrigida (§3.5)
  const counted = workdays.filter((w) => w.status !== 'incomplete' && summaries.get(w.id)!.isConsistent);

  let workedMs = 0;
  let breakMs = 0;
  let night = 0;
  const workedByDate = new Map<DateKey, number>();
  const starts: number[] = [];
  const ends: number[] = [];

  for (const w of counted) {
    const s = summaries.get(w.id)!;
    workedMs += s.workedMs;
    breakMs += s.breakMs;
    for (const seg of s.segments) night += nightMs(seg);
    workedByDate.set(w.refDate, (workedByDate.get(w.refDate) ?? 0) + s.workedMs);
    if (s.span) {
      starts.push(minutesFromRefDate(w.refDate, s.span.start));
      if (!s.isOpen) ends.push(minutesFromRefDate(w.refDate, s.span.end));
    }
  }

  // Interjornadas: entre jornadas consecutivas (ordenadas pelo início)
  const spans = counted
    .map((w) => summaries.get(w.id)!)
    .filter((s) => s.span && !s.isOpen)
    .map((s) => s.span!)
    .sort((a, b) => a.start - b.start);
  const rests: number[] = [];
  for (let i = 1; i < spans.length; i++) rests.push(Math.max(0, spans[i].start - spans[i - 1].end));

  const dayOffCounts: Record<DayOffKind, number> = { folga: 0, ferias: 0, atestado: 0, feriado: 0 };
  const days = new Map<DateKey, DayStatus>();
  let holidaysOff = 0;
  let holidaysWorked = 0;
  let daysWithoutRecord = 0;

  for (const date of periodDates(period)) {
    const dayWorkdays = byDate.get(date) ?? [];
    const dayOff = dayOffByDate.get(date);
    const holiday = holidays.get(date) ?? null;
    const worked = workedByDate.get(date) ?? 0;

    if (dayWorkdays.length > 0) {
      days.set(date, {
        type: 'worked',
        workdayIds: dayWorkdays.map((w) => w.id),
        workedMs: worked,
        holiday,
        incomplete: dayWorkdays.some((w) => w.status === 'incomplete' || !summaries.get(w.id)!.isConsistent),
      });
      if (holiday) holidaysWorked++;
    } else if (dayOff) {
      // H6: folga manual prevalece sobre o feriado na exibição
      days.set(date, { type: 'dayOff', kind: dayOff.kind });
    } else if (date > today) {
      days.set(date, { type: 'future', holiday });
    } else if (holiday) {
      days.set(date, { type: 'holiday', holiday });
      holidaysOff++;
    } else {
      days.set(date, { type: 'empty' });
      if (date < today) daysWithoutRecord++;
    }

    if (dayOff) dayOffCounts[dayOff.kind]++;
  }

  const classified = classifyHours([...leadDays, ...buildDayHours({ workdays, dayOffs, holidays, sundayDouble, now })], rules);
  const overtime = new Map([...classified].filter(([date]) => date >= period.start && date <= period.end));
  const extras = sumOvertime(overtime, period.start, period.end);

  const workedDays = [...workedByDate.entries()].filter(([, ms]) => ms > 0);
  const daysWorked = workedDays.length;
  const sortedByMs = [...workedDays].sort((a, b) => b[1] - a[1]);

  return {
    workedMs,
    breakMs,
    nightMs: night,
    daysWorked,
    dayOffs: dayOffCounts,
    dayOffTotal: Object.values(dayOffCounts).reduce((a, b) => a + b, 0),
    holidaysOff,
    holidaysWorked,
    extraMs: extras.extraMs,
    extraDoubleMs: extras.extraDoubleMs,
    overtime,
    avgWorkedPerDayMs: daysWorked ? workedMs / daysWorked : 0,
    avgBreakPerDayMs: daysWorked ? breakMs / daysWorked : 0,
    longest: sortedByMs.length ? { date: sortedByMs[0][0], ms: sortedByMs[0][1] } : null,
    shortest: sortedByMs.length ? { date: sortedByMs.at(-1)![0], ms: sortedByMs.at(-1)![1] } : null,
    avgStartMinutes: average(starts),
    avgEndMinutes: average(ends),
    minRestMs: rests.length ? Math.min(...rests) : null,
    shortRestCount: rests.filter((r) => r < MIN_REST_MS).length,
    daysWithoutRecord,
    incompleteCount: workdays.length - counted.length,
    days,
    summaries,
  };
}
