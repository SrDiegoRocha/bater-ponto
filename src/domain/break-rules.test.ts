import { checkBreak, minBreakMs } from './break-rules';
import { HOUR, MINUTE } from './time';

const day = (spans: [number, number][]) => {
  const segments = spans.map(([s, e]) => ({ start: s * MINUTE, end: e * MINUTE }));
  const workedMs = segments.reduce((sum, s) => sum + s.end - s.start, 0);
  const breakMs = segments.slice(1).reduce((sum, s, i) => sum + s.start - segments[i].end, 0);
  return { segments, workedMs, breakMs };
};

describe('intervalo mínimo (art. 71)', () => {
  it('mínimo por duração da jornada', () => {
    expect(minBreakMs(4 * HOUR)).toBe(0);
    expect(minBreakMs(5 * HOUR)).toBe(15 * MINUTE);
    expect(minBreakMs(8 * HOUR)).toBe(HOUR);
  });

  it('8h com 1h de almoço está ok', () => {
    expect(checkBreak(day([[480, 720], [780, 1020]]), { splitBreak: false })).toBeNull();
  });

  it('8h com 30 min de almoço é curto', () => {
    expect(checkBreak(day([[480, 720], [750, 990]]), { splitBreak: false })).toEqual({ kind: 'short', minMs: HOUR, breakMs: 30 * MINUTE });
  });

  it('jornada longa sem intervalo nenhum', () => {
    expect(checkBreak(day([[480, 960]]), { splitBreak: false })).toMatchObject({ kind: 'short', breakMs: 0 });
  });
});

describe('regra do motorista (§5º)', () => {
  // 04:30–06:20, 06:50–09:50, 12:30–13:20, 13:50–16:50
  const driver = day([[270, 380], [410, 590], [750, 800], [830, 1010]]);

  it('intervalos fracionados dentro da janela estão ok', () => {
    expect(checkBreak(driver, { splitBreak: true })).toBeNull();
    // Sem a regra, a mesma jornada tem intervalo de sobra (3h50)
    expect(checkBreak(driver, { splitBreak: false })).toBeNull();
  });

  it('intervalo antes do fim da 1ª hora fica fora da janela', () => {
    expect(checkBreak(day([[480, 520], [540, 1000]]), { splitBreak: true })).toEqual({ kind: 'splitOutOfWindow' });
  });

  it('intervalo curto é aceito com a regra do motorista', () => {
    expect(checkBreak(day([[480, 720], [740, 980]]), { splitBreak: true })).toBeNull();
  });
});
