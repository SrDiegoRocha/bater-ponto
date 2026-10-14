import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { HolidayOverride } from '@/domain/holidays';
import type { DateKey } from '@/domain/types';

// Só guarda o que o usuário mudou: feriados próprios e desativações (PLANEJAMENTO.md §3.7).

type Row = {
  id: string;
  kind: 'custom' | 'disabled';
  date: string | null;
  month_day: string | null;
  year: number | null;
  name: string | null;
  holiday_key: string | null;
};

export async function listHolidayOverrides(db: SQLiteDatabase): Promise<HolidayOverride[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM holiday_override');
  return rows.map((r) =>
    r.kind === 'disabled'
      ? { kind: 'disabled', holidayKey: r.holiday_key!, year: r.year }
      : { kind: 'custom', id: r.id, name: r.name ?? 'Feriado', date: r.date, monthDay: r.month_day },
  );
}

export async function addCustomHoliday(
  db: SQLiteDatabase,
  h: { name: string; date: DateKey; recurring: boolean },
): Promise<void> {
  await db.runAsync(
    'INSERT INTO holiday_override (id, kind, date, month_day, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    randomUUID(),
    'custom',
    h.recurring ? null : h.date,
    h.recurring ? h.date.slice(5) : null,
    h.name,
    Date.now(),
  );
}

export async function disableHoliday(db: SQLiteDatabase, holidayKey: string, year: number | null): Promise<void> {
  await db.runAsync(
    'INSERT INTO holiday_override (id, kind, holiday_key, year, created_at) VALUES (?, ?, ?, ?, ?)',
    randomUUID(),
    'disabled',
    holidayKey,
    year,
    Date.now(),
  );
}

export async function enableHoliday(db: SQLiteDatabase, holidayKey: string, year: number | null): Promise<void> {
  await db.runAsync(
    "DELETE FROM holiday_override WHERE kind = 'disabled' AND holiday_key = ? AND year IS ?",
    holidayKey,
    year,
  );
}

export async function deleteCustomHoliday(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM holiday_override WHERE kind = 'custom' AND id = ?", id);
}
