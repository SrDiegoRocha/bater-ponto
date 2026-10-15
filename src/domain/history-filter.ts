import type { Holiday } from './holidays';
import { nightMs } from './night-hours';
import type { WorkdayInput } from './stats';
import type { DateKey, DayOff } from './types';
import type { DayOvertime } from './work-rules';
import type { WorkdaySummary } from './workday';

// Filtros rápidos do Histórico.

export type HistoryFilter = 'all' | 'overtime' | 'incomplete' | 'holiday' | 'night';

export function filterWorkdays<T extends WorkdayInput>(
  workdays: readonly T[],
  filter: HistoryFilter,
  ctx: {
    summaries: ReadonlyMap<string, WorkdaySummary>;
    holidays: ReadonlyMap<DateKey, Holiday>;
    dayOffs: readonly DayOff[];
    /** Classificação dos dias pelas regras da jornada (PeriodStats.overtime) */
    overtime: ReadonlyMap<DateKey, DayOvertime>;
  },
): T[] {
  if (filter === 'all') return [...workdays];
  return workdays.filter((w) => {
    const s = ctx.summaries.get(w.id);
    if (!s) return false;
    const incomplete = w.status === 'incomplete' || !s.isConsistent;
    switch (filter) {
      case 'incomplete':
        return incomplete;
      case 'holiday':
        return ctx.holidays.has(w.refDate);
      case 'night':
        return s.segments.some((seg) => nightMs(seg) > 0);
      case 'overtime': {
        const o = ctx.overtime.get(w.refDate);
        return !incomplete && !!o && o.extraMs + o.extraDoubleMs > 0;
      }
    }
  });
}
