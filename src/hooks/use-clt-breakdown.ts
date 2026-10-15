import { useMemo } from 'react';

import { computeCltPay, type CltBreakdown, type CltConfig } from '@/domain/clt';
import type { Period } from '@/domain/period';
import type { Settings } from '@/db/settings-repo';
import { useSettings } from '@/stores/settings-store';

import { usePeriodStats } from './use-period-stats';

/** Regras da CLT configuradas pelo usuário (Ajustes → Salário) */
export function cltConfigFromSettings(settings: Settings, hourlyRate = settings.hourlyRate): CltConfig {
  return {
    hourlyRate,
    goal: settings.dailyGoal,
    overtimePct: settings.overtimePct,
    holidayOvertimePct: settings.holidayOvertimePct,
    nightPct: settings.nightPct,
    nightReduced: settings.nightReduced,
    dsrOnExtras: settings.dsrOnExtras,
    sundayDouble: settings.sundayDouble,
    dependents: settings.dependents,
  };
}

/** O que o app calcula pela CLT no período, a partir das batidas anotadas */
export function useCltBreakdown(period: Period): CltBreakdown | null {
  const settings = useSettings();
  const { stats, workdays, dayOffs, holidays, now } = usePeriodStats(period);
  return useMemo(() => {
    if (!stats) return null;
    return computeCltPay({ period, workdays, dayOffs, holidays, now, config: cltConfigFromSettings(settings) });
  }, [stats, period, workdays, dayOffs, holidays, now, settings]);
}
