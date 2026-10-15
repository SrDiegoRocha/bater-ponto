import type { DayState } from './state-machine';

// Previsão de saída (tela Hoje): quanto falta para a meta e a que horas ela é atingida.

export type Forecast =
  | { kind: 'done'; overMs: number }
  | { kind: 'working'; remainingMs: number; reachAt: number }
  | { kind: 'break'; remainingMs: number; reachIfResumeNowAt: number }
  | { kind: 'off'; remainingMs: number }
  | { kind: 'none' };

export function forecastGoal(workedMs: number, goalMs: number, state: DayState, now: number): Forecast {
  if (goalMs <= 0) return { kind: 'none' };
  const remainingMs = goalMs - workedMs;
  if (remainingMs <= 0) return { kind: 'done', overMs: -remainingMs };
  if (state === 'working') return { kind: 'working', remainingMs, reachAt: now + remainingMs };
  if (state === 'break') return { kind: 'break', remainingMs, reachIfResumeNowAt: now + remainingMs };
  return { kind: 'off', remainingMs };
}
