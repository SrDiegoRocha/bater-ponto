import { periodLabel, periodRangeLabel, type Period } from '@/domain/period';
import type { PeriodStats } from '@/domain/stats';

import { formatDuration, formatMoney } from './format';

// Resumo do período em texto, para colar no WhatsApp/e-mail.

export function buildSummaryText(period: Period, stats: PeriodStats, money: { label: string; cents: number } | null): string {
  const offs = [
    stats.dayOffs.folga && `${stats.dayOffs.folga} folga${stats.dayOffs.folga > 1 ? 's' : ''}`,
    stats.dayOffs.ferias && `${stats.dayOffs.ferias} de férias`,
    stats.dayOffs.atestado && `${stats.dayOffs.atestado} de atestado`,
    stats.holidaysOff && `${stats.holidaysOff} feriado${stats.holidaysOff > 1 ? 's' : ''}`,
  ].filter(Boolean);

  const lines = [
    `🕐 Ponto · ${periodLabel(period)} (${periodRangeLabel(period)})`,
    '',
    `Trabalhadas: ${formatDuration(stats.workedMs)} em ${stats.daysWorked} ${stats.daysWorked === 1 ? 'dia' : 'dias'}`,
    `Intervalos: ${formatDuration(stats.breakMs)}`,
    `Banco de horas: ${formatDuration(stats.balanceMs, { signed: true })}`,
    offs.length ? `Folgas: ${offs.join(', ')}` : null,
    stats.nightMs > 0 ? `Horas noturnas: ${formatDuration(stats.nightMs)}` : null,
    stats.holidaysWorked > 0 ? `Feriados trabalhados: ${stats.holidaysWorked}` : null,
    money ? `${money.label}: ${formatMoney(money.cents)}` : null,
    stats.incompleteCount > 0 ? `⚠️ ${stats.incompleteCount} jornada(s) incompleta(s) fora dos totais` : null,
    '',
    'Gerado pelo app Bater Ponto',
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}
