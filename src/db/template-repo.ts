import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ShiftTemplate, TemplateShift } from '@/domain/templates';

// Escalas modelo (turnos salvos com nome).

type Row = { id: string; name: string; shifts: string };

export async function listTemplates(db: SQLiteDatabase): Promise<ShiftTemplate[]> {
  const rows = await db.getAllAsync<Row>('SELECT id, name, shifts FROM shift_template ORDER BY created_at');
  return rows.map((r) => ({ id: r.id, name: r.name, shifts: JSON.parse(r.shifts) as TemplateShift[] }));
}

export async function saveTemplate(db: SQLiteDatabase, t: { id?: string; name: string; shifts: TemplateShift[] }): Promise<string> {
  const id = t.id ?? randomUUID();
  await db.runAsync(
    `INSERT INTO shift_template (id, name, shifts, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, shifts = excluded.shifts`,
    id,
    t.name,
    JSON.stringify(t.shifts),
    Date.now(),
  );
  return id;
}

export async function deleteTemplate(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM shift_template WHERE id = ?', id);
}
