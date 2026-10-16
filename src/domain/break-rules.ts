import { HOUR, MINUTE } from './time';
import type { Span } from './types';

// Intervalo para descanso e refeição (CLT art. 71).
//
// - Mais de 6h trabalhadas: no mínimo 1h de intervalo. Entre 4h e 6h: 15 min. Até 4h: nenhum.
// - §5º (motoristas, cobradores e fiscais do transporte coletivo): com convenção coletiva, o intervalo
//   pode ser reduzido e/ou fracionado, desde que fique entre o fim da 1ª hora e o começo da última hora
//   trabalhada. Aí não existe mínimo, mas o 1º e o último turno precisam ter pelo menos 1h cada.

export function minBreakMs(workedMs: number): number {
  if (workedMs > 6 * HOUR) return HOUR;
  if (workedMs > 4 * HOUR) return 15 * MINUTE;
  return 0;
}

export type BreakIssue =
  /** Intervalo somado abaixo do mínimo */
  | { kind: 'short'; minMs: number; breakMs: number }
  /** Regra do motorista: intervalo antes do fim da 1ª hora ou depois do começo da última */
  | { kind: 'splitOutOfWindow' };

/** Problema no intervalo da jornada, ou null se está dentro da regra. Jornada em andamento não é checada. */
export function checkBreak(
  { segments, workedMs, breakMs }: { segments: readonly Span[]; workedMs: number; breakMs: number },
  { splitBreak }: { splitBreak: boolean },
): BreakIssue | null {
  if (segments.length === 0) return null;
  if (splitBreak) {
    if (segments.length < 2) return null;
    const first = segments[0];
    const last = segments.at(-1)!;
    if (first.end - first.start < HOUR || last.end - last.start < HOUR) return { kind: 'splitOutOfWindow' };
    return null;
  }
  const minMs = minBreakMs(workedMs);
  // 1 min de folga para arredondamento do relógio da empresa
  if (breakMs + MINUTE <= minMs) return { kind: 'short', minMs, breakMs };
  return null;
}

/** Texto curto para avisos */
export function describeBreakIssue(issue: BreakIssue, format: (ms: number) => string): string {
  if (issue.kind === 'short') {
    return issue.breakMs === 0
      ? `Sem intervalo. Pela CLT, essa jornada pede pelo menos ${format(issue.minMs)}.`
      : `Intervalo de ${format(issue.breakMs)}: a CLT pede pelo menos ${format(issue.minMs)} para essa jornada.`;
  }
  return 'Pela regra do motorista, o intervalo precisa começar depois da 1ª hora e terminar antes da última hora de trabalho.';
}
