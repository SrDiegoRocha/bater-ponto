import type { MinuteOfDay } from './time-of-day';
import { resolveSequence } from './time-of-day';
import { fromDateKey } from './time';
import type { DateKey } from './types';

// Escalas modelo: turnos salvos com nome (ex.: "Escala A: 08–11 / 16–23"), aplicáveis a qualquer dia.

export type TemplateShift = { start: MinuteOfDay; end: MinuteOfDay };

export type ShiftTemplate = {
  id: string;
  name: string;
  shifts: TemplateShift[];
};

/** Turnos da escala transformados em instantes numa data (horários que "voltam" viram o dia seguinte) */
export function templateToShifts(template: Pick<ShiftTemplate, 'shifts'>, date: DateKey): { start: number; end: number }[] {
  const instants = resolveSequence(
    fromDateKey(date).getTime(),
    template.shifts.flatMap((s) => [s.start, s.end]),
  );
  return template.shifts.map((_, i) => ({ start: instants[i * 2], end: instants[i * 2 + 1] }));
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (m: MinuteOfDay) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** "08:00–11:00 · 16:00–23:00" */
export function describeTemplate(template: Pick<ShiftTemplate, 'shifts'>): string {
  return template.shifts.map((s) => `${hhmm(s.start)}–${hhmm(s.end)}`).join(' · ');
}

/** Turnos a partir das batidas de uma jornada completa (para "salvar como escala") */
export function shiftsFromPunches(punches: readonly { kind: 'in' | 'out'; at: number }[]): TemplateShift[] | null {
  if (punches.length === 0 || punches.length % 2 !== 0) return null;
  const toMinute = (at: number) => {
    const d = new Date(at);
    return d.getHours() * 60 + d.getMinutes();
  };
  const shifts: TemplateShift[] = [];
  for (let i = 0; i < punches.length; i += 2) {
    if (punches[i].kind !== 'in' || punches[i + 1].kind !== 'out') return null;
    shifts.push({ start: toMinute(punches[i].at), end: toMinute(punches[i + 1].at) });
  }
  return shifts;
}
