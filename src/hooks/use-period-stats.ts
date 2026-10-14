import { useMemo } from 'react';

import { holidaysInRange } from '@/domain/holidays';
import { getPeriodContaining, shiftPeriod, type Period } from '@/domain/period';
import { computePeriodStats } from '@/domain/stats';
import { toDateKey } from '@/domain/time';
import { listDayOffs } from '@/db/day-off-repo';
import { listHolidayOverrides } from '@/db/holiday-repo';
import { listWorkdays } from '@/db/workday-repo';
import { useSettings } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';

import { useDbQuery } from './use-db-query';
import { useNow } from './use-now';

export function useCurrentPeriod(): Period {
  const { periodStartDay } = useSettings();
  const today = toDateKey(useNow());
  return useMemo(() => getPeriodContaining(today, periodStartDay), [today, periodStartDay]);
}

/** Período escolhido no seletor (compartilhado entre as abas) */
export function useSelectedPeriod(): Period {
  const { periodStartDay } = useSettings();
  const offset = useUiStore((s) => s.periodOffset);
  const current = useCurrentPeriod();
  return useMemo(() => shiftPeriod(current, offset, periodStartDay), [current, offset, periodStartDay]);
}

/** Dados brutos + indicadores de um período. Recalcula a cada minuto (jornada aberta conta até agora). */
export function usePeriodStats(period: Period) {
  const { dailyGoal, optionalHolidays } = useSettings();
  const now = useNow();
  const { data } = useDbQuery(
    async (db) => ({
      workdays: await listWorkdays(db, period.start, period.end),
      dayOffs: await listDayOffs(db, period.start, period.end),
      overrides: await listHolidayOverrides(db),
    }),
    [period.start, period.end],
  );

  const holidays = useMemo(
    () => holidaysInRange(period.start, period.end, data?.overrides ?? [], { includeOptional: optionalHolidays }),
    [period.start, period.end, data?.overrides, optionalHolidays],
  );

  const stats = useMemo(() => {
    if (!data) return null;
    return computePeriodStats({
      period,
      workdays: data.workdays,
      dayOffs: data.dayOffs,
      holidays,
      goal: dailyGoal,
      today: toDateKey(now),
      now,
    });
  }, [data, period, holidays, dailyGoal, now]);

  return { stats, workdays: data?.workdays ?? [], dayOffs: data?.dayOffs ?? [], holidays, now };
}
