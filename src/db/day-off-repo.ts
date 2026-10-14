import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey, DayOff, DayOffKind } from '@/domain/types';

// Folgas por data de calendário (PLANEJAMENTO.md §3.3).

export async function listDayOffs(db: SQLiteDatabase, start: DateKey, end: DateKey): Promise<DayOff[]> {
  return db.getAllAsync<DayOff>(
    'SELECT date, kind, note FROM day_off WHERE date BETWEEN ? AND ? ORDER BY date',
    start,
    end,
  );
}

/** F4: marca várias datas de uma vez */
export async function upsertDayOffs(
  db: SQLiteDatabase,
  dates: readonly DateKey[],
  kind: DayOffKind,
  note: string | null = null,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const date of dates) {
      await db.runAsync(
        `INSERT INTO day_off (date, kind, note, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET kind = excluded.kind, note = excluded.note`,
        date,
        kind,
        note,
        now,
      );
    }
  });
}

export async function deleteDayOffs(db: SQLiteDatabase, dates: readonly DateKey[]): Promise<void> {
  if (dates.length === 0) return;
  await db.runAsync(`DELETE FROM day_off WHERE date IN (${dates.map(() => '?').join(',')})`, [...dates]);
}
