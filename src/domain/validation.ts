import { HOUR, MINUTE } from './time';
import { sortPunches } from './workday';
import type { Punch } from './types';

// Regras das batidas (PLANEJAMENTO.md §3.2) e limites do editor de horário (§3.11 ED4).

export const FUTURE_TOLERANCE_MS = MINUTE; // R3
export const SHORT_SEGMENT_MS = MINUTE; // R6
export const DEFAULT_MAX_WORKDAY_MS = 24 * HOUR; // R5
export const MIN_REST_MS = 11 * HOUR; // interjornada CLT

export type PunchIssue =
  | { code: 'must-start-with-in' }
  | { code: 'not-alternating'; index: number }
  | { code: 'not-chronological'; index: number }
  | { code: 'future'; index: number }
  | { code: 'too-long' };

type Checkable = Pick<Punch, 'kind' | 'at'>;

/** R1, R2, R3 e R5 sobre as batidas de UMA jornada, na ordem em que foram registradas */
export function validateSequence(
  punches: readonly Checkable[],
  { now = Date.now(), maxWorkdayMs = DEFAULT_MAX_WORKDAY_MS } = {},
): PunchIssue[] {
  const issues: PunchIssue[] = [];
  if (punches.length === 0) return issues;
  if (punches[0].kind !== 'in') issues.push({ code: 'must-start-with-in' });

  punches.forEach((p, i) => {
    if (p.at > now + FUTURE_TOLERANCE_MS) issues.push({ code: 'future', index: i });
    if (i === 0) return;
    if (p.at <= punches[i - 1].at) issues.push({ code: 'not-chronological', index: i });
    if (p.kind === punches[i - 1].kind) issues.push({ code: 'not-alternating', index: i });
  });

  const sorted = sortPunches(punches);
  const last = sorted.at(-1)!;
  const end = last.kind === 'in' ? now : last.at;
  if (end - sorted[0].at > maxWorkdayMs) issues.push({ code: 'too-long' });
  return issues;
}

export type EditBounds = {
  /** Menor horário permitido, inclusive (null = sem limite) */
  min: number | null;
  /** Maior horário permitido, inclusive */
  max: number;
};

/**
 * Limites para mover a batida `index` (ED4): fica estritamente entre as vizinhas (1 min de folga),
 * depois do fim da jornada anterior, antes do início da próxima e nunca no futuro.
 */
export function editBounds(
  punches: readonly Checkable[],
  index: number,
  {
    now = Date.now(),
    previousWorkdayEnd = null,
    nextWorkdayStart = null,
  }: { now?: number; previousWorkdayEnd?: number | null; nextWorkdayStart?: number | null } = {},
): EditBounds {
  const sorted = sortPunches(punches);
  const prev = sorted[index - 1];
  const next = sorted[index + 1];

  const lowers = [prev?.at, previousWorkdayEnd].filter((v): v is number => v != null);
  const uppers = [next?.at, nextWorkdayStart].filter((v): v is number => v != null);

  const min = lowers.length ? Math.max(...lowers) + MINUTE : null;
  const max = Math.min(uppers.length ? Math.min(...uppers) - MINUTE : Infinity, now);
  return { min, max };
}

export function clampToBounds(at: number, bounds: EditBounds): number {
  const lower = bounds.min ?? -Infinity;
  return Math.min(Math.max(at, lower), bounds.max);
}

export function isWithinBounds(at: number, bounds: EditBounds): boolean {
  return (bounds.min === null || at >= bounds.min) && at <= bounds.max;
}
