// Tipos do domínio (PLANEJAMENTO.md §2 e §8). Instantes são epoch em ms (UTC); datas de calendário
// são strings locais 'YYYY-MM-DD' (DateKey).

export type DateKey = string;

export type PunchKind = 'in' | 'out';
export type PunchSource = 'live' | 'retro' | 'manual';

export type Punch = {
  id: string;
  workdayId: string;
  kind: PunchKind;
  at: number;
  tz: string;
  isDayStart: boolean;
  isDayEnd: boolean;
  /** Horário original quando a batida foi editada (R9/ED7) */
  originalAt: number | null;
  source: PunchSource;
};

export type WorkdayStatus = 'open' | 'closed' | 'incomplete';

export type Workday = {
  id: string;
  /** Data da batida de início do dia (data de referência) */
  refDate: DateKey;
  status: WorkdayStatus;
  note: string | null;
};

export type DayOffKind = 'folga' | 'ferias' | 'atestado' | 'feriado';

export type DayOff = {
  date: DateKey;
  kind: DayOffKind;
  note: string | null;
};

/** Intervalo de tempo [start, end) em ms */
export type Span = { start: number; end: number };
