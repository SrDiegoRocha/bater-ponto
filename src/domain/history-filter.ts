import { goalForDate, type DailyGoalConfig } from './balance';
import type { Holiday } from './holidays';
import { nightMs } from './night-hours';
import type { WorkdayInput } from './stats';
import type { DateKey, DayOff } from './types';
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
    goal: DailyGoalConfig;
  },
): T[] {
  if (filter === 'all') return [...workdays];
  const offDates = new Set(ctx.dayOffs.map((d) => d.date));
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
        const goal = goalForDate(w.refDate, ctx.goal, { isNonWorkingDay: offDates.has(w.refDate) || ctx.holidays.has(w.refDate) });
        return !incomplete && s.workedMs > goal;
      }
    }
  });
}
