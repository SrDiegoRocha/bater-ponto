import type { SQLiteDatabase } from 'expo-sqlite';

import type { DayCheck } from '@/domain/timesheet-check';
import type { DateKey } from '@/domain/types';

// Conferência do espelho de ponto: um registro por dia conferido.

type Row = { date: string; status: 'ok' | 'diff'; company_worked_ms: number | null; note: string | null };

const toCheck = (r: Row): DayCheck => ({ date: r.date, status: r.status, companyWorkedMs: r.company_worked_ms, note: r.note });

export async function listDayChecks(db: SQLiteDatabase, start: DateKey, end: DateKey): Promise<DayCheck[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM day_check WHERE date BETWEEN ? AND ? ORDER BY date', start, end);
  return rows.map(toCheck);
}

export async function getDayCheck(db: SQLiteDatabase, date: DateKey): Promise<DayCheck | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM day_check WHERE date = ?', date);
  return row ? toCheck(row) : null;
}

export async function saveDayChecks(db: SQLiteDatabase, checks: readonly DayCheck[]): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const c of checks) {
      await db.runAsync(
        `INSERT INTO day_check (date, status, company_worked_ms, note, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET status = excluded.status, company_worked_ms = excluded.company_worked_ms,
           note = excluded.note, updated_at = excluded.updated_at`,
        c.date,
        c.status,
        c.companyWorkedMs,
        c.note,
        now,
      );
    }
  });
}

export async function deleteDayCheck(db: SQLiteDatabase, date: DateKey): Promise<void> {
  await db.runAsync('DELETE FROM day_check WHERE date = ?', date);
}
