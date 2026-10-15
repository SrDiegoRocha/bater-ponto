import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupData } from '@/domain/backup-schema';

import { DEVICE_ONLY_SETTINGS } from './settings-repo';

// Exporta/importa o banco inteiro (PLANEJAMENTO.md §3.9). A importação substitui tudo numa transação
// exclusiva: ou entra tudo, ou nada (B5).

export async function exportData(db: SQLiteDatabase): Promise<BackupData> {
  const workdays = await db.getAllAsync<{ id: string; ref_date: string; status: BackupData['workdays'][number]['status']; note: string | null }>(
    'SELECT id, ref_date, status, note FROM workday ORDER BY ref_date',
  );
  const punches = await db.getAllAsync<{
    id: string; workday_id: string; kind: 'in' | 'out'; at: number; tz: string;
    is_day_start: number; is_day_end: number; original_at: number | null; source: 'live' | 'retro' | 'manual';
  }>('SELECT * FROM punch ORDER BY at');
  const dayOffs = await db.getAllAsync<BackupData['dayOffs'][number]>('SELECT date, kind, note FROM day_off ORDER BY date');
  const overrides = await db.getAllAsync<{
    id: string; kind: 'custom' | 'disabled'; date: string | null; month_day: string | null;
    year: number | null; name: string | null; holiday_key: string | null;
  }>('SELECT * FROM holiday_override');
  const templates = await db.getAllAsync<{ id: string; name: string; shifts: string }>('SELECT id, name, shifts FROM shift_template ORDER BY created_at');
  const settingRows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM setting');

  const settings: Record<string, unknown> = {};
  for (const { key, value } of settingRows) {
    if ((DEVICE_ONLY_SETTINGS as readonly string[]).includes(key)) continue; // L7
    try {
      settings[key] = JSON.parse(value);
    } catch {
      // ignora valor corrompido
    }
  }

  return {
    workdays: workdays.map((w) => ({ id: w.id, refDate: w.ref_date, status: w.status, note: w.note })),
    punches: punches.map((p) => ({
      id: p.id,
      workdayId: p.workday_id,
      kind: p.kind,
      at: p.at,
      tz: p.tz,
      isDayStart: p.is_day_start === 1,
      isDayEnd: p.is_day_end === 1,
      originalAt: p.original_at,
      source: p.source,
    })),
    dayOffs,
    holidayOverrides: overrides.map((o) => ({
      id: o.id,
      kind: o.kind,
      date: o.date,
      monthDay: o.month_day,
      year: o.year,
      name: o.name,
      holidayKey: o.holiday_key,
    })),
    templates: templates.map((t) => ({ id: t.id, name: t.name, shifts: JSON.parse(t.shifts) })),
    settings,
  };
}

/** Apaga dados de uso. Configurações do aparelho (trava) são preservadas. */
async function wipe(db: SQLiteDatabase, run: (sql: string, ...params: (string | number | null)[]) => Promise<unknown>) {
  await run('DELETE FROM punch');
  await run('DELETE FROM workday');
  await run('DELETE FROM day_off');
  await run('DELETE FROM holiday_override');
  await run('DELETE FROM shift_template');
  const keep = DEVICE_ONLY_SETTINGS.map(() => '?').join(',');
  await run(`DELETE FROM setting WHERE key NOT IN (${keep})`, ...DEVICE_ONLY_SETTINGS);
}

export async function wipeAllData(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await wipe(db, (sql, ...params) => txn.runAsync(sql, params));
  });
}

export async function importData(db: SQLiteDatabase, data: BackupData): Promise<void> {
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const run = (sql: string, ...params: (string | number | null)[]) => txn.runAsync(sql, params);
    await wipe(db, run);
    for (const w of data.workdays) {
      await run(
        'INSERT INTO workday (id, ref_date, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        w.id, w.refDate, w.status, w.note, now, now,
      );
    }
    for (const p of data.punches) {
      await run(
        `INSERT INTO punch (id, workday_id, kind, at, tz, is_day_start, is_day_end, original_at, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.workdayId, p.kind, p.at, p.tz, p.isDayStart ? 1 : 0, p.isDayEnd ? 1 : 0, p.originalAt, p.source, now, now,
      );
    }
    for (const d of data.dayOffs) {
      await run('INSERT INTO day_off (date, kind, note, created_at) VALUES (?, ?, ?, ?)', d.date, d.kind, d.note, now);
    }
    for (const o of data.holidayOverrides) {
      await run(
        'INSERT INTO holiday_override (id, kind, date, month_day, year, name, holiday_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        o.id, o.kind, o.date, o.monthDay, o.year, o.name, o.holidayKey, now,
      );
    }
    for (const t of data.templates) {
      await run('INSERT INTO shift_template (id, name, shifts, created_at) VALUES (?, ?, ?, ?)', t.id, t.name, JSON.stringify(t.shifts), now);
    }
    for (const [key, value] of Object.entries(data.settings)) {
      if ((DEVICE_ONLY_SETTINGS as readonly string[]).includes(key)) continue;
      await run('INSERT INTO setting (key, value) VALUES (?, ?)', key, JSON.stringify(value));
    }
  });
}
