import { forecastGoal } from './forecast';
import { HOUR, MINUTE } from './time';

const now = new Date('2026-10-14T17:20:00').getTime();

it('trabalhando: faltam 1h20, completa às 18:40', () => {
  expect(forecastGoal(6 * HOUR + 40 * MINUTE, 8 * HOUR, 'working', now)).toEqual({
    kind: 'working',
    remainingMs: 80 * MINUTE,
    reachAt: now + 80 * MINUTE,
  });
});

it('em pausa: se voltar agora', () => {
  expect(forecastGoal(7 * HOUR, 8 * HOUR, 'break', now)).toMatchObject({ kind: 'break', reachIfResumeNowAt: now + HOUR });
});

it('meta batida', () => {
  expect(forecastGoal(9 * HOUR, 8 * HOUR, 'working', now)).toEqual({ kind: 'done', overMs: HOUR });
});

it('sem meta (folga) não prevê nada', () => {
  expect(forecastGoal(2 * HOUR, 0, 'working', now)).toEqual({ kind: 'none' });
});
