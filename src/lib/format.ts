import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { fromDateKey, HOUR, MINUTE } from '@/domain/time';
import type { DateKey } from '@/domain/types';

// Formatos fixos do app (PLANEJAMENTO.md §6.9).

/** "5h 42min" · "42min" · "8h" · com sinal opcional para saldos ("+1h 10min" / "−25min") */
export function formatDuration(ms: number, { signed = false } = {}): string {
  const negative = ms < 0;
  const totalMinutes = Math.floor(Math.abs(ms) / MINUTE);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const body = h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}min`;
  if (!signed) return negative ? `−${body}` : body;
  if (totalMinutes === 0) return body;
  return `${negative ? '−' : '+'}${body}`;
}

/** "05:42" — para tabelas e cronômetros (horas podem passar de 24) */
export function formatClock(ms: number, { seconds = false } = {}): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / HOUR);
  const m = Math.floor((abs % HOUR) / MINUTE);
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (!seconds) return base;
  const s = Math.floor((abs % MINUTE) / 1000);
  return `${base}:${String(s).padStart(2, '0')}`;
}

/** "08:00" (24h) */
export function formatTime(at: number): string {
  return format(at, 'HH:mm');
}

/** "ter, 14 out" */
export function formatShortDate(date: DateKey | number): string {
  const d = typeof date === 'string' ? fromDateKey(date) : new Date(date);
  const weekday = format(d, 'EEEE', { locale: ptBR }).slice(0, 3);
  return `${weekday}, ${format(d, 'd MMM', { locale: ptBR }).replace(/\./g, '')}`;
}

/** "Terça, 14 out" */
export function formatLongDay(date: DateKey | number): string {
  const d = typeof date === 'string' ? fromDateKey(date) : new Date(date);
  const text = format(d, "EEEE, d MMM", { locale: ptBR }).replace('-feira', '').replace(/\./g, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "R$ 1.234,56" a partir de centavos (sem depender de Intl) */
export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = String(abs % 100).padStart(2, '0');
  return `${negative ? '−' : ''}R$ ${reais},${centavos}`;
}
