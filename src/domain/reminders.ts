import { addDaysToKey, fromDateKey, MINUTE, toDateKey } from './time';
import type { DateKey } from './types';

// Lembretes para não esquecer de anotar o ponto. Nada depende de horário fixo de trabalho, para
// servir também a quem tem escala variável:
//
// 1. Passou do limite: trabalhando e o dia passou do limite diário há 15 min → "já anotou a saída?"
// 2. Intervalo longo: em intervalo há mais de X horas → "ainda no intervalo?"
// 2b. Fim do intervalo: o intervalo chegou ao tempo escolhido (padrão 1h, o mínimo da CLT) → hora de voltar
// 3. Fim do dia: num horário fixo, se nada foi anotado no dia. Só nos dias da semana em que a pessoa
//    costuma trabalhar (aprendido pelas últimas semanas), fora folgas e feriados.
//
// O plano é refeito sempre que os dados mudam, então os avisos dos próximos dias são cancelados
// sozinhos quando o dia é anotado.

export type ReminderSettings = {
  enabled: boolean;
  overLimit: boolean;
  longBreak: boolean;
  longBreakMinutes: number;
  breakEnd: boolean;
  breakEndMinutes: number;
  endOfDay: boolean;
  /** Minutos desde 00:00 */
  endOfDayMinutes: number;
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  overLimit: true,
  longBreak: true,
  longBreakMinutes: 180,
  breakEnd: false,
  breakEndMinutes: 60,
  endOfDay: true,
  endOfDayMinutes: 21 * 60,
};

export const OVER_LIMIT_GRACE_MS = 15 * MINUTE;
/** Quantos dias à frente o lembrete de fim do dia fica agendado (cobre quem passa dias sem abrir o app) */
export const END_OF_DAY_HORIZON = 7;
export const REMINDER_ID_PREFIX = 'lembrete-';

export type PlannedReminder = { id: string; at: number; title: string; body: string; href: string };

type Input = {
  now: number;
  settings: ReminderSettings;
  dailyLimitMs: number;
  /** Batidas da jornada aberta (null = nenhuma aberta) */
  openPunches: readonly { kind: 'in' | 'out'; at: number }[] | null;
  /** Horas trabalhadas na jornada aberta até agora */
  openWorkedMs: number;
  /** Datas que já têm alguma jornada anotada */
  recordedDates: ReadonlySet<DateKey>;
  /** Folgas e feriados dos próximos dias */
  skipDates: ReadonlySet<DateKey>;
  /** Dias da semana (0 = domingo) com jornada nas últimas semanas; vazio = usuário novo */
  workWeekdays: ReadonlySet<number>;
};

const atMinutes = (date: DateKey, minutes: number) => {
  const d = fromDateKey(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
};

export function planReminders({
  now,
  settings,
  dailyLimitMs,
  openPunches,
  openWorkedMs,
  recordedDates,
  skipDates,
  workWeekdays,
}: Input): PlannedReminder[] {
  if (!settings.enabled) return [];
  const plan: PlannedReminder[] = [];
  const last = openPunches?.at(-1) ?? null;

  // 1. Trabalhando: avisa um pouco depois de passar do limite do dia (se já passou, o aviso já foi)
  if (settings.overLimit && last?.kind === 'in' && dailyLimitMs > 0) {
    const at = now + (dailyLimitMs - openWorkedMs) + OVER_LIMIT_GRACE_MS;
    if (at > now) {
      plan.push({
        id: `${REMINDER_ID_PREFIX}limite`,
        at,
        title: 'Já anotou a saída?',
        body: 'Seu dia passou do limite de horas. Se você já saiu, anote o horário para a conta ficar certa.',
        href: '/bater',
      });
    }
  }

  // 2. Em intervalo há tempo demais
  if (settings.longBreak && last?.kind === 'out') {
    const at = last.at + settings.longBreakMinutes * MINUTE;
    if (at > now) {
      plan.push({
        id: `${REMINDER_ID_PREFIX}intervalo`,
        at,
        title: 'Ainda no intervalo?',
        body: 'Se você já voltou ao trabalho, anote a volta do intervalo.',
        href: '/bater',
      });
    }
  }

  // 2b. O intervalo completou o tempo combinado
  if (settings.breakEnd && last?.kind === 'out') {
    const at = last.at + settings.breakEndMinutes * MINUTE;
    if (at > now) {
      plan.push({
        id: `${REMINDER_ID_PREFIX}fim-intervalo`,
        at,
        title: 'Seu intervalo terminou',
        body: 'Quando voltar ao trabalho, anote a volta do intervalo.',
        href: '/bater',
      });
    }
  }

  // 3. Fim do dia sem nada anotado
  if (settings.endOfDay) {
    const today = toDateKey(now);
    // Sem histórico ainda: todos os dias menos domingo
    const weekdays = workWeekdays.size > 0 ? workWeekdays : new Set([1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < END_OF_DAY_HORIZON; i++) {
      const date = addDaysToKey(today, i);
      const at = atMinutes(date, settings.endOfDayMinutes);
      if (at <= now || skipDates.has(date) || recordedDates.has(date)) continue;
      if (!weekdays.has(fromDateKey(date).getDay())) continue;
      // Hoje com jornada aberta: os outros lembretes já cuidam disso
      if (i === 0 && openPunches) continue;
      plan.push({
        id: `${REMINDER_ID_PREFIX}dia-${date}`,
        at,
        title: 'Anotou o ponto de hoje?',
        body: 'Copie os horários do app da empresa para conferir suas horas no fim do mês.',
        href: '/bater',
      });
    }
  }

  return plan.sort((a, b) => a.at - b.at);
}

/** Dias da semana com jornada anotada, a partir das datas de referência recentes */
export function weekdaysFromDates(dates: Iterable<DateKey>): Set<number> {
  const set = new Set<number>();
  for (const d of dates) set.add(fromDateKey(d).getDay());
  return set;
}
