import type { PayslipValues } from './payslip';
import type { DayCheck } from './timesheet-check';

// Formato do arquivo de backup (PLANEJAMENTO.md §3.9). Versionado, validado antes de qualquer gravação.

export const BACKUP_APP_ID = 'bater-ponto';
export const BACKUP_SCHEMA_VERSION = 4;

export type BackupWorkday = { id: string; refDate: string; status: 'open' | 'closed' | 'incomplete'; note: string | null };
export type BackupPunch = {
  id: string;
  workdayId: string;
  kind: 'in' | 'out';
  at: number;
  tz: string;
  isDayStart: boolean;
  isDayEnd: boolean;
  originalAt: number | null;
  source: 'live' | 'retro' | 'manual';
};
export type BackupDayOff = { date: string; kind: 'folga' | 'ferias' | 'atestado' | 'feriado'; note: string | null };
export type BackupHolidayOverride = {
  id: string;
  kind: 'custom' | 'disabled';
  date: string | null;
  monthDay: string | null;
  year: number | null;
  name: string | null;
  holidayKey: string | null;
};

export type BackupTemplate = { id: string; name: string; shifts: { start: number; end: number }[] };

export type BackupPayslip = { periodStart: string; periodEnd: string; values: PayslipValues };

export type BackupDayCheck = DayCheck;

export type BackupData = {
  workdays: BackupWorkday[];
  punches: BackupPunch[];
  dayOffs: BackupDayOff[];
  holidayOverrides: BackupHolidayOverride[];
  /** v2+ */
  templates: BackupTemplate[];
  /** v3+ */
  payslips: BackupPayslip[];
  /** v4+ */
  dayChecks: BackupDayCheck[];
  settings: Record<string, unknown>;
};

export type BackupFile = {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  appVersion: string;
  createdAt: number;
  data: BackupData;
};

export type BackupPreview = {
  workdays: number;
  punches: number;
  dayOffs: number;
  firstDate: string | null;
  lastDate: string | null;
  createdAt: number;
};

export type ParseResult = { ok: true; file: BackupFile; preview: BackupPreview } | { ok: false; error: string };

export function buildBackup(data: BackupData, appVersion: string, createdAt = Date.now()): BackupFile {
  return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, appVersion, createdAt, data };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNullable = <T>(v: unknown, check: (x: unknown) => x is T) => v === null || check(v);

function validWorkday(w: unknown): w is BackupWorkday {
  return (
    isObj(w) &&
    isStr(w.id) &&
    isStr(w.refDate) &&
    DATE_RE.test(w.refDate) &&
    ['open', 'closed', 'incomplete'].includes(w.status as string) &&
    isNullable(w.note, isStr)
  );
}

function validPunch(p: unknown): p is BackupPunch {
  return (
    isObj(p) &&
    isStr(p.id) &&
    isStr(p.workdayId) &&
    (p.kind === 'in' || p.kind === 'out') &&
    isNum(p.at) &&
    isStr(p.tz) &&
    typeof p.isDayStart === 'boolean' &&
    typeof p.isDayEnd === 'boolean' &&
    isNullable(p.originalAt, isNum) &&
    ['live', 'retro', 'manual'].includes(p.source as string)
  );
}

function validDayOff(d: unknown): d is BackupDayOff {
  return (
    isObj(d) &&
    isStr(d.date) &&
    DATE_RE.test(d.date) &&
    ['folga', 'ferias', 'atestado', 'feriado'].includes(d.kind as string) &&
    isNullable(d.note, isStr)
  );
}

function validOverride(o: unknown): o is BackupHolidayOverride {
  return (
    isObj(o) &&
    isStr(o.id) &&
    (o.kind === 'custom' || o.kind === 'disabled') &&
    isNullable(o.date, isStr) &&
    isNullable(o.monthDay, isStr) &&
    isNullable(o.year, isNum) &&
    isNullable(o.name, isStr) &&
    isNullable(o.holidayKey, isStr)
  );
}

function validTemplate(t: unknown): t is BackupTemplate {
  return (
    isObj(t) &&
    isStr(t.id) &&
    isStr(t.name) &&
    Array.isArray(t.shifts) &&
    t.shifts.every((s) => isObj(s) && isNum(s.start) && isNum(s.end))
  );
}

const PAYSLIP_HOURS = ['extraMs', 'extraDoubleMs', 'nightMs'] as const;
const PAYSLIP_MONEY = ['extraCents', 'extraDoubleCents', 'nightCents', 'dsrCents'] as const;

function validPayslip(p: unknown): p is BackupPayslip {
  if (!isObj(p) || !isStr(p.periodStart) || !DATE_RE.test(p.periodStart) || !isStr(p.periodEnd) || !DATE_RE.test(p.periodEnd)) {
    return false;
  }
  const v = p.values;
  return (
    isObj(v) &&
    (v.hoursFormat === 'decimal' || v.hoursFormat === 'clock') &&
    [...PAYSLIP_HOURS, ...PAYSLIP_MONEY].every((k) => isNullable(v[k], isNum))
  );
}

function validDayCheck(c: unknown): c is BackupDayCheck {
  return (
    isObj(c) &&
    isStr(c.date) &&
    DATE_RE.test(c.date) &&
    (c.status === 'ok' || c.status === 'diff') &&
    isNullable(c.companyWorkedMs, isNum) &&
    isNullable(c.note, isStr)
  );
}

/** Migra arquivos de versões antigas para a atual (B6), um passo por versão */
function migrate(file: Record<string, unknown>): Record<string, unknown> {
  let f = file;
  // v1 → v2: ainda não havia escalas modelo
  if (f.schemaVersion === 1 && isObj(f.data)) f = { ...f, schemaVersion: 2, data: { ...f.data, templates: [] } };
  // v2 → v3: ainda não havia holerites conferidos
  if (f.schemaVersion === 2 && isObj(f.data)) f = { ...f, schemaVersion: 3, data: { ...f.data, payslips: [] } };
  // v3 → v4: ainda não havia conferência do espelho
  if (f.schemaVersion === 3 && isObj(f.data)) f = { ...f, schemaVersion: 4, data: { ...f.data, dayChecks: [] } };
  return f;
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um backup válido (JSON corrompido).' };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Este arquivo não é um backup do Bater Ponto.' };
  }
  if (!isNum(raw.schemaVersion)) return { ok: false, error: 'Backup sem versão.' };
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.' };
  }

  const file = migrate(raw);
  const data = file.data;
  if (!isObj(data)) return { ok: false, error: 'Backup sem dados.' };

  const { workdays, punches, dayOffs, holidayOverrides, templates, payslips, dayChecks, settings } = data;
  if (!Array.isArray(workdays) || !workdays.every(validWorkday)) return { ok: false, error: 'Jornadas inválidas no backup.' };
  if (!Array.isArray(punches) || !punches.every(validPunch)) return { ok: false, error: 'Batidas inválidas no backup.' };
  if (!Array.isArray(dayOffs) || !dayOffs.every(validDayOff)) return { ok: false, error: 'Folgas inválidas no backup.' };
  if (!Array.isArray(holidayOverrides) || !holidayOverrides.every(validOverride)) {
    return { ok: false, error: 'Feriados inválidos no backup.' };
  }
  if (!Array.isArray(templates) || !templates.every(validTemplate)) return { ok: false, error: 'Escalas inválidas no backup.' };
  if (!Array.isArray(payslips) || !payslips.every(validPayslip)) return { ok: false, error: 'Holerites inválidos no backup.' };
  if (!Array.isArray(dayChecks) || !dayChecks.every(validDayCheck)) {
    return { ok: false, error: 'Conferências do espelho inválidas no backup.' };
  }
  if (!isObj(settings)) return { ok: false, error: 'Configurações inválidas no backup.' };

  // Integridade: toda batida pertence a uma jornada do arquivo; ids únicos
  const workdayIds = new Set(workdays.map((w) => w.id));
  if (workdayIds.size !== workdays.length) return { ok: false, error: 'Jornadas duplicadas no backup.' };
  if (new Set(punches.map((p) => p.id)).size !== punches.length) return { ok: false, error: 'Batidas duplicadas no backup.' };
  if (!punches.every((p) => workdayIds.has(p.workdayId))) {
    return { ok: false, error: 'Há batidas sem jornada no backup.' };
  }

  const dates = workdays.map((w) => w.refDate).sort();
  const parsed: BackupFile = {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: isStr(file.appVersion) ? file.appVersion : '?',
    createdAt: isNum(file.createdAt) ? file.createdAt : 0,
    data: { workdays, punches, dayOffs, holidayOverrides, templates, payslips, dayChecks, settings },
  };
  return {
    ok: true,
    file: parsed,
    preview: {
      workdays: workdays.length,
      punches: punches.length,
      dayOffs: dayOffs.length,
      firstDate: dates[0] ?? null,
      lastDate: dates.at(-1) ?? null,
      createdAt: parsed.createdAt,
    },
  };
}
