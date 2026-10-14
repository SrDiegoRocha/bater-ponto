import { sortPunches } from './workday';
import type { Punch, PunchKind } from './types';

// Máquina de estados do dia (PLANEJAMENTO.md §3.1).
//
//   FORA ──Iniciar dia──▶ TRABALHANDO ──Pausar──▶ EM INTERVALO
//    ▲                      │   ▲                     │
//    └────Encerrar dia──────┘   └──────Voltar─────────┘
//    └──────────────────Encerrar dia──────────────────┘

export type DayState = 'off' | 'working' | 'break';
export type DayAction = 'startDay' | 'pause' | 'resume' | 'endDay';

/** Estado a partir das batidas da jornada aberta (ou null se não há jornada aberta) */
export function deriveDayState(openWorkdayPunches: readonly Pick<Punch, 'kind' | 'at' | 'isDayEnd'>[] | null): DayState {
  if (!openWorkdayPunches || openWorkdayPunches.length === 0) return 'off';
  const last = sortPunches(openWorkdayPunches).at(-1)!;
  if (last.isDayEnd) return 'off';
  return last.kind === 'in' ? 'working' : 'break';
}

export const actionsByState: Record<DayState, { primary: DayAction; secondary: DayAction | null }> = {
  off: { primary: 'startDay', secondary: null },
  working: { primary: 'pause', secondary: 'endDay' },
  break: { primary: 'resume', secondary: 'endDay' },
};

export type TransitionEffect =
  | { type: 'createPunch'; kind: PunchKind; isDayStart: boolean; isDayEnd: boolean; opensWorkday: boolean }
  /** Encerrar dia durante o intervalo: a última SAÍDA vira o fim do dia, sem batida nova */
  | { type: 'markLastAsDayEnd' };

export function transition(state: DayState, action: DayAction): TransitionEffect {
  switch (`${state}:${action}`) {
    case 'off:startDay':
      return { type: 'createPunch', kind: 'in', isDayStart: true, isDayEnd: false, opensWorkday: true };
    case 'working:pause':
      return { type: 'createPunch', kind: 'out', isDayStart: false, isDayEnd: false, opensWorkday: false };
    case 'break:resume':
      return { type: 'createPunch', kind: 'in', isDayStart: false, isDayEnd: false, opensWorkday: false };
    case 'working:endDay':
      return { type: 'createPunch', kind: 'out', isDayStart: false, isDayEnd: true, opensWorkday: false };
    case 'break:endDay':
      return { type: 'markLastAsDayEnd' };
    default:
      throw new Error(`Ação "${action}" não é válida no estado "${state}"`);
  }
}
