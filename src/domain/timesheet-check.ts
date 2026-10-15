import { periodDates, periodLabel, periodRangeLabel, type Period } from './period';
import type { WorkdayInput } from './stats';
import { MINUTE } from './time';
import type { DateKey } from './types';
import { sortPunches, summarizeWorkday } from './workday';

// Conferência do espelho de ponto, dia a dia: o usuário compara cada dia do espelho da empresa com
// o que anotou aqui e marca "bate" ou "diferente" (com as horas que o espelho mostra e uma observação).

export type DayCheckStatus = 'ok' | 'diff';

export type DayCheck = {
  date: DateKey;
  status: DayCheckStatus;
  /** Horas trabalhadas que o espelho mostra no dia (só em "diferente"; null = não informado) */
  companyWorkedMs: number | null;
  note: string | null;
};

export type CheckDay = {
  date: DateKey;
  /** Batidas anotadas no dia (todas as jornadas com essa data de referência), em ordem */
  punches: { kind: 'in' | 'out'; at: number }[];
  workedMs: number;
  /** Alguma jornada do dia está incompleta: as horas do app não são confiáveis */
  incomplete: boolean;
  check: DayCheck | null;
  /** espelho − app; negativo = o espelho tem menos horas que o anotado */
  diffMs: number | null;
};

/** Diferenças abaixo disso são arredondamento do relógio de ponto */
export const DAY_DIFF_TOLERANCE_MS = 5 * MINUTE;

type Input = {
  period: Period;
  today: DateKey;
  workdays: readonly WorkdayInput[];
  checks: readonly DayCheck[];
  now: number;
};

/** Dias do período até hoje, em ordem (igual ao espelho da empresa) */
export function buildCheckDays({ period, today, workdays, checks, now }: Input): CheckDay[] {
  const checkByDate = new Map(checks.map((c) => [c.date, c]));
  return periodDates(period)
    .filter((date) => date <= today)
    .map((date) => {
      const ofDay = workdays.filter((w) => w.refDate === date);
      let workedMs = 0;
      let incomplete = false;
      for (const w of ofDay) {
        const s = summarizeWorkday(w.punches, now);
        workedMs += s.workedMs;
        if (w.status === 'incomplete' || !s.isConsistent) incomplete = true;
      }
      const punches = sortPunches(ofDay.flatMap((w) => w.punches)).map((p) => ({ kind: p.kind, at: p.at }));
      const check = checkByDate.get(date) ?? null;
      const diffMs = check?.status === 'diff' && check.companyWorkedMs !== null ? check.companyWorkedMs - workedMs : null;
      return { date, punches, workedMs, incomplete, check, diffMs };
    });
}

export type CheckSummary = {
  total: number;
  checked: number;
  pending: number;
  diffs: number;
  /** Soma de espelho − app nos dias diferentes com horas informadas */
  diffMs: number;
};

export function summarizeChecks(days: readonly CheckDay[]): CheckSummary {
  const checked = days.filter((d) => d.check).length;
  const diffDays = days.filter((d) => d.check?.status === 'diff');
  return {
    total: days.length,
    checked,
    pending: days.length - checked,
    diffs: diffDays.length,
    diffMs: diffDays.reduce((sum, d) => sum + (d.diffMs ?? 0), 0),
  };
}

type Formatters = {
  date: (date: DateKey) => string;
  time: (at: number) => string;
  duration: (ms: number, opts?: { signed?: boolean }) => string;
};

/** Texto com os dias diferentes, para mandar ao RH */
export function buildDiffText(period: Period, days: readonly CheckDay[], fmt: Formatters): string {
  const diffDays = days.filter((d) => d.check?.status === 'diff');
  const summary = summarizeChecks(days);
  const lines = [`📋 Diferenças no espelho de ponto · ${periodLabel(period)} (${periodRangeLabel(period)})`, ''];
  for (const d of diffDays) {
    const pairs: string[] = [];
    for (let i = 0; i < d.punches.length; i += 2) {
      const out = d.punches[i + 1];
      pairs.push(`${fmt.time(d.punches[i].at)}–${out ? fmt.time(out.at) : '?'}`);
    }
    lines.push(`• ${fmt.date(d.date)}`);
    lines.push(`  Meus registros: ${pairs.length ? `${pairs.join(', ')} = ${fmt.duration(d.workedMs)}` : 'nenhum'}`);
    if (d.check!.companyWorkedMs !== null) {
      lines.push(`  Espelho: ${fmt.duration(d.check!.companyWorkedMs)} (${fmt.duration(d.diffMs!, { signed: true })})`);
    }
    if (d.check!.note) lines.push(`  Obs.: ${d.check!.note}`);
  }
  if (summary.diffMs !== 0) {
    lines.push('', `Diferença total: ${fmt.duration(summary.diffMs, { signed: true })} no espelho em relação aos meus registros`);
  }
  return lines.join('\n');
}
