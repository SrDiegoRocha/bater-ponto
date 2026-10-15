import { buildBackup, parseBackup, type BackupData } from './backup-schema';
import { EMPTY_PAYSLIP } from './payslip';

const data: BackupData = {
  workdays: [{ id: 'w1', refDate: '2026-10-13', status: 'closed', note: null }],
  punches: [
    { id: 'p1', workdayId: 'w1', kind: 'in', at: 1, tz: 'America/Sao_Paulo', isDayStart: true, isDayEnd: false, originalAt: null, source: 'live' },
    { id: 'p2', workdayId: 'w1', kind: 'out', at: 2, tz: 'America/Sao_Paulo', isDayStart: false, isDayEnd: true, originalAt: 3, source: 'live' },
  ],
  dayOffs: [{ date: '2026-10-11', kind: 'folga', note: 'domingo' }],
  holidayOverrides: [{ id: 'h1', kind: 'disabled', date: null, monthDay: null, year: 2026, name: null, holidayKey: 'aparecida' }],
  templates: [{ id: 't1', name: 'Escala A', shifts: [{ start: 480, end: 660 }] }],
  payslips: [
    {
      periodStart: '2026-09-21',
      periodEnd: '2026-10-20',
      values: { ...EMPTY_PAYSLIP, extraMs: 36_000_000, dsrCents: 5000 },
    },
  ],
  settings: { periodStartDay: 21, hourlyRate: 25 },
};

describe('backup', () => {
  it('ida e volta preserva tudo', () => {
    const result = parseBackup(JSON.stringify(buildBackup(data, '1.0.0', 123)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.data).toEqual(data);
    expect(result.preview).toEqual({
      workdays: 1,
      punches: 2,
      dayOffs: 1,
      firstDate: '2026-10-13',
      lastDate: '2026-10-13',
      createdAt: 123,
    });
  });

  it.each([
    ['{oops', 'corrompido'],
    [JSON.stringify({ app: 'outro-app' }), 'não é um backup'],
    [JSON.stringify({ ...buildBackup(data, '1'), schemaVersion: 99 }), 'versão mais nova'],
  ])('rejeita arquivo inválido %#', (text, message) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it('B6: arquivo v1 (sem escalas nem holerites) é migrado', () => {
    const { templates: _t, payslips: _p, ...v1data } = data;
    const v1 = { app: 'bater-ponto', schemaVersion: 1, appVersion: '1.0.0', createdAt: 1, data: v1data };
    const result = parseBackup(JSON.stringify(v1));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.data.templates).toEqual([]);
      expect(result.file.data.payslips).toEqual([]);
    }
  });

  it('B6: arquivo v2 (sem holerites) é migrado', () => {
    const { payslips: _p, ...v2data } = data;
    const v2 = { app: 'bater-ponto', schemaVersion: 2, appVersion: '1.0.0', createdAt: 1, data: v2data };
    const result = parseBackup(JSON.stringify(v2));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.data.templates).toEqual(data.templates);
      expect(result.file.data.payslips).toEqual([]);
    }
  });

  it('rejeita holerite inválido', () => {
    const bad = { ...data, payslips: [{ ...data.payslips[0], values: { ...data.payslips[0].values, hoursFormat: 'x' } }] };
    expect(parseBackup(JSON.stringify(buildBackup(bad as unknown as BackupData, '1'))).ok).toBe(false);
  });

  it('rejeita batida sem jornada', () => {
    const bad = { ...data, punches: [{ ...data.punches[0], workdayId: 'nao-existe' }] };
    const result = parseBackup(JSON.stringify(buildBackup(bad, '1')));
    expect(result.ok).toBe(false);
  });

  it('rejeita tipos errados', () => {
    const bad = { ...data, punches: [{ ...data.punches[0], at: 'ontem' }] };
    expect(parseBackup(JSON.stringify(buildBackup(bad as unknown as BackupData, '1'))).ok).toBe(false);
  });
});
