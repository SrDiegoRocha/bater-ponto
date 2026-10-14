import { goalForDate, type DailyGoalConfig } from '@/domain/balance';
import type { CltBreakdown } from '@/domain/clt';
import type { Holiday } from '@/domain/holidays';
import { periodDates, periodLabel, type Period } from '@/domain/period';
import type { PeriodStats } from '@/domain/stats';
import { toDateKey } from '@/domain/time';
import type { DateKey, DayOff, Punch, Workday } from '@/domain/types';
import { summarizeWorkday } from '@/domain/workday';

import { formatDuration, formatMoney, formatShortDate, formatTime } from './format';

// Espelho de ponto em HTML → PDF (PLANEJAMENTO.md §3.8). Sempre em tema claro (E4), A4 retrato.

export type TimesheetInput = {
  period: Period;
  stats: PeriodStats;
  workdays: readonly (Workday & { punches: Punch[] })[];
  dayOffs: readonly DayOff[];
  holidays: ReadonlyMap<DateKey, Holiday>;
  goal: DailyGoalConfig;
  userName: string;
  generatedAt: number;
  salary: { mode: 'simple'; hourlyRate: number; grossCents: number } | { mode: 'clt'; hourlyRate: number; breakdown: CltBreakdown } | null;
};

const DAY_OFF_LABEL = { folga: 'Folga', ferias: 'Férias', atestado: 'Atestado', feriado: 'Feriado' } as const;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SYMBOL = `<svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 3 A9 9 0 1 1 4.2058 7.5" stroke="#0B7F50" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="4.2058" cy="7.5" r="2.25" fill="#0B7F50"/></svg>`;

export function buildTimesheetHtml(input: TimesheetInput): string {
  const { period, stats, workdays, dayOffs, holidays, goal, userName, generatedAt, salary } = input;
  const byDate = new Map<DateKey, (Workday & { punches: Punch[] })[]>();
  for (const w of workdays) byDate.set(w.refDate, [...(byDate.get(w.refDate) ?? []), w]);
  const dayOffByDate = new Map(dayOffs.map((d) => [d.date, d]));

  const rows = periodDates(period).map((date) => {
    const list = (byDate.get(date) ?? []).sort((a, b) => (a.punches[0]?.at ?? 0) - (b.punches[0]?.at ?? 0));
    const dayOff = dayOffByDate.get(date);
    const holiday = holidays.get(date);
    const weekday = formatShortDate(date).split(',')[0];
    const dateCell = `<td class="date">${date.slice(8)}/${date.slice(5, 7)}</td><td class="wd">${weekday}</td>`;

    if (list.length === 0) {
      const label = dayOff ? DAY_OFF_LABEL[dayOff.kind] : holiday ? `Feriado · ${esc(holiday.name)}` : '';
      const note = dayOff?.note ? esc(dayOff.note) : '';
      return `<tr class="${label ? 'off' : 'empty'}">${dateCell}<td colspan="4" class="label">${label}</td><td class="note">${note}</td></tr>`;
    }

    return list
      .map((w) => {
        const s = summarizeWorkday(w.punches, generatedAt);
        const punches = w.punches
          .map((p) => {
            const nextDay = toDateKey(p.at) !== date ? '<sup>+1</sup>' : '';
            return `<span class="${p.kind}">${formatTime(p.at)}${nextDay}${p.originalAt !== null ? '*' : ''}</span>`;
          })
          .join(' ');
        const incomplete = w.status === 'incomplete' || !s.isConsistent;
        const goalMs = goalForDate(date, goal, { isNonWorkingDay: !!dayOff || !!holiday });
        const balance = incomplete ? '—' : formatDuration(s.workedMs - goalMs, { signed: true });
        const extra = [holiday ? `Feriado · ${esc(holiday.name)}` : '', w.note ? esc(w.note) : '', incomplete ? 'Incompleta' : '', w.status === 'open' ? 'Em andamento' : '']
          .filter(Boolean)
          .join(' · ');
        return `<tr>${dateCell}<td class="punches">${punches}</td><td class="num">${formatDuration(s.workedMs)}</td><td class="num">${formatDuration(s.breakMs)}</td><td class="num">${balance}</td><td class="note">${extra}</td></tr>`;
      })
      .join('');
  });

  const dayOffSummary = (['folga', 'ferias', 'atestado', 'feriado'] as const)
    .filter((k) => stats.dayOffs[k] > 0)
    .map((k) => `${stats.dayOffs[k]} ${DAY_OFF_LABEL[k].toLowerCase()}`)
    .join(' · ');

  const totals = [
    ['Horas trabalhadas', formatDuration(stats.workedMs)],
    ['Intervalos', formatDuration(stats.breakMs)],
    ['Dias trabalhados', String(stats.daysWorked)],
    ['Folgas', dayOffSummary || '0'],
    ['Feriados', `${stats.holidaysWorked} trabalhados · ${stats.holidaysOff} de folga`],
    ['Horas noturnas', formatDuration(stats.nightMs)],
    ['Banco de horas', formatDuration(stats.balanceMs, { signed: true })],
  ];

  let salaryBlock = '';
  if (salary?.mode === 'simple') {
    salaryBlock = section('Salário estimado', [
      ['Valor da hora', formatMoney(Math.round(salary.hourlyRate * 100))],
      ['Total bruto', formatMoney(salary.grossCents)],
    ]);
  } else if (salary?.mode === 'clt') {
    const b = salary.breakdown;
    salaryBlock = section('Salário estimado (CLT)', [
      ['Valor da hora', formatMoney(Math.round(salary.hourlyRate * 100))],
      [`Horas normais (${formatDuration(b.normalMs)})`, formatMoney(b.normalPay)],
      [`Extras comuns (${formatDuration(b.extraMs)})`, formatMoney(b.extraPay)],
      [`Extras feriado/folga (${formatDuration(b.extraDoubleMs)})`, formatMoney(b.extraDoublePay)],
      ['Hora noturna reduzida', formatMoney(b.nightBonusPay)],
      ['Adicional noturno', formatMoney(b.nightAdditionalPay)],
      ['DSR sobre extras', formatMoney(b.dsrPay)],
      ['Bruto', formatMoney(b.gross)],
      ['INSS', `−${formatMoney(b.inss)}`],
      ['IRRF', b.irrf > 0 ? `−${formatMoney(b.irrf)}` : 'isento'],
      ['Líquido', formatMoney(b.net)],
    ]);
  }

  const generated = `${formatShortDate(generatedAt)} às ${formatTime(generatedAt)}`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Espelho de ponto · ${periodLabel(period)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0B0D10; font-size: 10.5px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0B0D10; padding-bottom: 8px; margin-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 16px; letter-spacing: -0.3px; }
  .brand .dot { color: #0B7F50; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .muted { color: #5B6472; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #5B6472; border-bottom: 1px solid #B9C0CB; padding: 4px; }
  td { padding: 4px; border-bottom: 1px solid #E4E7EC; vertical-align: top; }
  tr { page-break-inside: avoid; }
  td.date { font-weight: 600; white-space: nowrap; }
  td.wd { color: #5B6472; text-transform: capitalize; }
  td.num { text-align: right; white-space: nowrap; }
  td.punches { word-break: keep-all; }
  td.punches span { display: inline-block; margin-right: 6px; white-space: nowrap; }
  td.punches .in { color: #0B7F50; } td.punches .out { color: #956200; }
  td.note { color: #5B6472; }
  tr.off td.label { color: #5B48D9; font-weight: 600; }
  tr.empty td { color: #B9C0CB; }
  .sections { display: flex; gap: 16px; margin-top: 14px; page-break-inside: avoid; }
  .section { flex: 1; border: 1px solid #E4E7EC; border-radius: 8px; padding: 8px 10px; }
  .section h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #5B6472; margin: 0 0 6px; }
  .section div { display: flex; justify-content: space-between; padding: 2px 0; }
  footer { margin-top: 14px; font-size: 9px; color: #5B6472; }
</style></head>
<body>
  <header>
    <div>
      <div class="brand">${SYMBOL}<span>bater ponto<span class="dot">.</span></span></div>
      <h1>Espelho de ponto · ${periodLabel(period)}</h1>
      <div class="muted">${formatShortDate(period.start)} a ${formatShortDate(period.end)}${userName ? ` · ${esc(userName)}` : ''}</div>
    </div>
    <div class="muted">Gerado em ${generated}</div>
  </header>
  <table>
    <thead><tr><th>Data</th><th>Dia</th><th>Batidas</th><th style="text-align:right">Trabalhado</th><th style="text-align:right">Intervalo</th><th style="text-align:right">Saldo</th><th>Obs.</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <div class="sections">
    ${section('Totais do período', totals)}
    ${salaryBlock}
  </div>
  <footer>* horário editado manualmente · +1 = dia seguinte · Gerado pelo app Bater Ponto. Valores estimados.</footer>
</body></html>`;
}

function section(title: string, lines: string[][]): string {
  return `<div class="section"><h2>${title}</h2>${lines.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>`;
}
