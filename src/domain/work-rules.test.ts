import { HOUR, MINUTE } from './time';
import { buildDayHours, classifyHours, CLT_RULES, describeRules, sumOvertime, weekStart, type DayHours } from './work-rules';
import type { WorkdayInput } from './stats';

const t = (iso: string) => new Date(iso).getTime();
const day = (date: string, workedMs: number, premium = false): DayHours => ({ date, workedMs, premium });
const H = (h: number, m = 0) => h * HOUR + m * MINUTE;

// Semana de 12/10/2026 (segunda) a 18/10/2026 (domingo)
const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];

it('semana começa na segunda', () => {
  expect(weekStart('2026-10-14')).toBe('2026-10-12');
  expect(weekStart('2026-10-12')).toBe('2026-10-12');
  expect(weekStart('2026-10-18')).toBe('2026-10-12'); // domingo fecha a semana
});

it('escala de motorista: 8h40 por dia, 6 dias = 8h de extra na semana', () => {
  // 40 min por dia passam das 8h (4h) + 48h normais estouram as 44h da semana (mais 4h)
  const result = classifyHours(week.map((d) => day(d, H(8, 40))), CLT_RULES);
  const total = sumOvertime(result, week[0], week.at(-1)!);
  expect(total.extraMs).toBe(H(8));
  expect(total.normalMs).toBe(H(44));
  expect(result.get('2026-10-12')).toEqual({ normalMs: H(8), extraMs: H(0, 40), extraDoubleMs: 0 });
  // No sábado a semana já tinha 40h normais: só cabem mais 4h
  expect(result.get('2026-10-17')).toEqual({ normalMs: H(4), extraMs: H(4, 40), extraDoubleMs: 0 });
});

it('mesma escala em 5 dias: só a extra diária (3h20)', () => {
  const result = classifyHours(week.slice(0, 5).map((d) => day(d, H(8, 40))), CLT_RULES);
  expect(sumOvertime(result, week[0], week[4]).extraMs).toBe(H(3, 20));
});

it('acordo de compensação: 8h48 de seg a sex não tem extra', () => {
  const rules = { ...CLT_RULES, compensation: true };
  const result = classifyHours(week.slice(0, 5).map((d) => day(d, H(8, 48))), rules);
  expect(sumOvertime(result, week[0], week[4]).extraMs).toBe(0);
});

it('acordo de compensação: passou de 10h no dia é extra, e a semana continua limitada', () => {
  const rules = { ...CLT_RULES, compensation: true };
  const result = classifyHours([day(week[0], H(11)), ...week.slice(1).map((d) => day(d, H(8)))], rules);
  // seg: 1h acima das 10h; semana: 10 + 5×8 = 50h normais → 6h passam das 44h
  expect(result.get(week[0])!.extraMs).toBe(H(1));
  expect(sumOvertime(result, week[0], week.at(-1)!).extraMs).toBe(H(7));
});

it('tolerância: até 10 min a mais no dia não contam; passou, conta tudo', () => {
  const result = classifyHours([day(week[0], H(8, 10)), day(week[1], H(8, 11))], CLT_RULES);
  expect(result.get(week[0])!.extraMs).toBe(0);
  expect(result.get(week[1])!.extraMs).toBe(H(0, 11));
  const strict = classifyHours([day(week[0], H(8, 10))], { ...CLT_RULES, tolerance: false });
  expect(strict.get(week[0])!.extraMs).toBe(H(0, 10));
});

it('feriado/folga: tudo extra 100% e fora da conta da semana', () => {
  const result = classifyHours([day(week[0], H(6), true), ...week.slice(1).map((d) => day(d, H(8)))], CLT_RULES);
  expect(result.get(week[0])).toEqual({ normalMs: 0, extraMs: 0, extraDoubleMs: H(6) });
  expect(sumOvertime(result, week[0], week.at(-1)!).extraMs).toBe(0); // 5 × 8h = 40h normais
});

it('contrato menor (6h/36h)', () => {
  const rules = { ...CLT_RULES, dailyLimitMinutes: 360, weeklyLimitMinutes: 36 * 60 };
  const result = classifyHours([day(week[0], H(7))], rules);
  expect(result.get(week[0])!.extraMs).toBe(H(1));
});

it('dias antes do período fecham a semana, mas não entram na soma', () => {
  // período começa na quinta (15/10); seg–qua (fora do período) já somaram 24h normais na semana
  const days = [day(week[0], H(8)), day(week[1], H(8)), day(week[2], H(8)), day(week[3], H(8)), day(week[4], H(8)), day(week[5], H(8))];
  const result = classifyHours(days, CLT_RULES);
  const inPeriod = sumOvertime(result, week[3], week.at(-1)!);
  expect(inPeriod.normalMs).toBe(H(20)); // qui 8 + sex 8 + sáb 4
  expect(inPeriod.extraMs).toBe(H(4));
});

it('semanas diferentes recomeçam a conta', () => {
  const result = classifyHours(
    [...week.map((d) => day(d, H(8))), ...['2026-10-19', '2026-10-20'].map((d) => day(d, H(8)))],
    CLT_RULES,
  );
  expect(result.get('2026-10-19')!.extraMs).toBe(0);
});

it('buildDayHours soma jornadas por data e marca feriado, folga e domingo', () => {
  const w = (id: string, date: string, a: string, b: string, status: WorkdayInput['status'] = 'closed'): WorkdayInput => ({
    id,
    refDate: date,
    status,
    note: null,
    punches: [
      { kind: 'in', at: t(`${date}T${a}:00`) },
      { kind: 'out', at: t(`${date}T${b}:00`) },
    ],
  });
  const days = buildDayHours({
    workdays: [
      w('1', '2026-10-13', '08:00', '12:00'),
      w('2', '2026-10-13', '18:00', '20:00'),
      w('3', '2026-10-18', '08:00', '10:00'),
      w('4', '2026-10-14', '08:00', '09:00', 'incomplete'),
    ],
    dayOffs: [],
    holidays: new Map(),
    sundayDouble: true,
    now: t('2026-10-20T00:00:00'),
  });
  expect(days).toEqual([
    { date: '2026-10-13', workedMs: H(6), premium: false },
    { date: '2026-10-18', workedMs: H(2), premium: true },
  ]);
});

it('describeRules', () => {
  expect(describeRules(CLT_RULES)).toBe('8h por dia · 44h por semana');
  expect(describeRules({ ...CLT_RULES, dailyLimitMinutes: 7 * 60 + 20 })).toBe('7h20 por dia · 44h por semana');
});
