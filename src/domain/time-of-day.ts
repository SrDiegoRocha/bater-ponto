import { DAY, MINUTE } from './time';

// Converte horários de relógio (minutos desde 00:00) em instantes, respeitando a ordem:
// cada horário é a primeira ocorrência DEPOIS do anterior. Assim "23:00 → 02:00" vira o dia seguinte
// sem o usuário precisar escolher a data (jornadas que passam da meia-noite, §2).

export type MinuteOfDay = number;

export function minuteOfDay(at: number): MinuteOfDay {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/** Primeira ocorrência de `minutes` estritamente depois de `after` (ou no próprio instante, se `inclusive`) */
export function nextOccurrence(after: number, minutes: MinuteOfDay, { inclusive = false } = {}): number {
  const d = new Date(after);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  let at = d.getTime();
  while (inclusive ? at < after : at <= after) {
    const next = new Date(at + DAY);
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); // robusto a mudança de fuso/horário de verão
    at = next.getTime();
  }
  return at;
}

/** Resolve uma sequência de horários a partir da meia-noite (ou de um instante) de referência */
export function resolveSequence(anchor: number, minutes: readonly MinuteOfDay[]): number[] {
  const result: number[] = [];
  let previous = anchor - MINUTE; // o primeiro horário pode cair exatamente no anchor
  for (const m of minutes) {
    const at = nextOccurrence(previous, m);
    result.push(at);
    previous = at;
  }
  return result;
}
