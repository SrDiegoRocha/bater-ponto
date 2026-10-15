import { useMemo } from 'react';

import type { Period } from '@/domain/period';
import { toDateKey } from '@/domain/time';
import { buildCheckDays, summarizeChecks } from '@/domain/timesheet-check';
import { listDayChecks } from '@/db/day-check-repo';

import { useDbQuery } from './use-db-query';
import { usePeriodStats } from './use-period-stats';

/** Dias do período para conferir com o espelho de ponto, com o que já foi conferido */
export function useTimesheetCheck(period: Period) {
  const { stats, workdays, now } = usePeriodStats(period);
  const { data: checks } = useDbQuery((d) => listDayChecks(d, period.start, period.end), [period.start, period.end]);

  return useMemo(() => {
    if (!stats || !checks) return null;
    const days = buildCheckDays({ period, today: toDateKey(now), workdays, checks, now });
    return { days, summary: summarizeChecks(days), dayStatus: stats.days };
  }, [stats, checks, period, workdays, now]);
}
