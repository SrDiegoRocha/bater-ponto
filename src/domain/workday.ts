import type { Punch, Span } from './types';

// Cálculos de uma jornada (PLANEJAMENTO.md §2 e §3.5).

export type Segment = Span & {
  /** Turno ainda aberto (ENTRADA sem SAÍDA); `end` = agora */
  open: boolean;
};

export type WorkdaySummary = {
  segments: Segment[];
  breaks: Span[];
  workedMs: number;
  breakMs: number;
  /** Do início do dia até o fim do dia (ou agora, se aberta) */
  span: Span | null;
  isOpen: boolean;
  /** false quando as batidas não alternam ENTRADA/SAÍDA (dados a corrigir) */
  isConsistent: boolean;
};

export function sortPunches<T extends Pick<Punch, 'at'>>(punches: readonly T[]): T[] {
  return [...punches].sort((a, b) => a.at - b.at);
}

/**
 * Agrupa batidas em turnos ENTRADA→SAÍDA e calcula trabalho e intervalos.
 * `now` só é usado para o turno em andamento (jornada aberta entra nos totais até agora).
 */
export function summarizeWorkday(
  punches: readonly Pick<Punch, 'kind' | 'at'>[],
  now: number = Date.now(),
): WorkdaySummary {
  const sorted = sortPunches(punches);
  const segments: Segment[] = [];
  let isConsistent = true;
  let openStart: number | null = null;

  for (const punch of sorted) {
    if (punch.kind === 'in') {
      if (openStart !== null) isConsistent = false;
      openStart = punch.at;
    } else {
      if (openStart === null) {
        isConsistent = false;
        continue;
      }
      segments.push({ start: openStart, end: punch.at, open: false });
      openStart = null;
    }
  }

  const isOpen = openStart !== null;
  if (openStart !== null) segments.push({ start: openStart, end: Math.max(openStart, now), open: true });

  const breaks: Span[] = [];
  for (let i = 1; i < segments.length; i++) {
    breaks.push({ start: segments[i - 1].end, end: segments[i].start });
  }

  const workedMs = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const breakMs = breaks.reduce((sum, b) => sum + (b.end - b.start), 0);
  const span = segments.length
    ? { start: segments[0].start, end: segments[segments.length - 1].end }
    : null;

  return { segments, breaks, workedMs, breakMs, span, isOpen, isConsistent };
}

/** Descanso entre o fim de uma jornada e o início da próxima (CLT: mínimo 11h) */
export function interjornadaMs(previousEnd: number, nextStart: number): number {
  return Math.max(0, nextStart - previousEnd);
}
