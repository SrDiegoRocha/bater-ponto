import { actionsByState, deriveDayState, transition } from './state-machine';

const p = (kind: 'in' | 'out', at: number, isDayEnd = false) => ({ kind, at, isDayEnd });

describe('deriveDayState', () => {
  it('sem jornada aberta → fora', () => {
    expect(deriveDayState(null)).toBe('off');
    expect(deriveDayState([])).toBe('off');
  });
  it('última batida ENTRADA → trabalhando', () => {
    expect(deriveDayState([p('in', 1)])).toBe('working');
  });
  it('última batida SAÍDA → em intervalo', () => {
    expect(deriveDayState([p('in', 1), p('out', 2)])).toBe('break');
  });
  it('última batida é fim do dia → fora', () => {
    expect(deriveDayState([p('in', 1), p('out', 2, true)])).toBe('off');
  });
});

describe('transition', () => {
  it('iniciar dia cria ENTRADA marcada como início e abre jornada', () => {
    expect(transition('off', 'startDay')).toEqual({
      type: 'createPunch',
      kind: 'in',
      isDayStart: true,
      isDayEnd: false,
      opensWorkday: true,
    });
  });
  it('encerrar dia trabalhando cria SAÍDA de fim do dia', () => {
    expect(transition('working', 'endDay')).toMatchObject({ type: 'createPunch', kind: 'out', isDayEnd: true });
  });
  it('encerrar dia no intervalo só marca a última SAÍDA', () => {
    expect(transition('break', 'endDay')).toEqual({ type: 'markLastAsDayEnd' });
  });
  it('ação inválida lança erro', () => {
    expect(() => transition('off', 'pause')).toThrow();
    expect(() => transition('working', 'resume')).toThrow();
  });
  it('cada estado tem a ação principal certa', () => {
    expect(actionsByState.off.primary).toBe('startDay');
    expect(actionsByState.working.primary).toBe('pause');
    expect(actionsByState.break.primary).toBe('resume');
  });
});
