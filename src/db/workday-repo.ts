import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { toDateKey } from '@/domain/time';
import type { DateKey, Punch, PunchKind, PunchSource, Workday, WorkdayStatus } from '@/domain/types';

// Jornadas e batidas. Toda escrita que mexe em mais de uma linha roda em transação.

type WorkdayRow = { id: string; ref_date: string; status: WorkdayStatus; note: string | null };
type PunchRow = {
  id: string;
  workday_id: string;
  kind: PunchKind;
  at: number;
  tz: string;
  is_day_start: number;
  is_day_end: number;
  original_at: number | null;
  source: PunchSource;
};

export type WorkdayWithPunches = Workday & { punches: Punch[] };

const toWorkday = (r: WorkdayRow): Workday => ({ id: r.id, refDate: r.ref_date, status: r.status, note: r.note });

const toPunch = (r: PunchRow): Punch => ({
  id: r.id,
  workdayId: r.workday_id,
  kind: r.kind,
  at: r.at,
  tz: r.tz,
  isDayStart: r.is_day_start === 1,
  isDayEnd: r.is_day_end === 1,
  originalAt: r.original_at,
  source: r.source,
});

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo';
}

async function attachPunches(db: SQLiteDatabase, workdays: Workday[]): Promise<WorkdayWithPunches[]> {
  if (workdays.length === 0) return [];
  const placeholders = workdays.map(() => '?').join(',');
  const rows = await db.getAllAsync<PunchRow>(
    `SELECT * FROM punch WHERE workday_id IN (${placeholders}) ORDER BY at`,
    workdays.map((w) => w.id),
  );
  const byWorkday = new Map<string, Punch[]>();
  for (const row of rows) {
    const list = byWorkday.get(row.workday_id) ?? [];
    list.push(toPunch(row));
    byWorkday.set(row.workday_id, list);
  }
  return workdays.map((w) => ({ ...w, punches: byWorkday.get(w.id) ?? [] }));
}

export async function getOpenWorkday(db: SQLiteDatabase): Promise<WorkdayWithPunches | null> {
  const row = await db.getFirstAsync<WorkdayRow>(
    "SELECT * FROM workday WHERE status = 'open' ORDER BY ref_date DESC LIMIT 1",
  );
  if (!row) return null;
  const [withPunches] = await attachPunches(db, [toWorkday(row)]);
  return withPunches;
}

/** Jornadas cuja data de referência está no intervalo (P3: a jornada pertence ao dia em que começou) */
export async function listWorkdays(db: SQLiteDatabase, start: DateKey, end: DateKey): Promise<WorkdayWithPunches[]> {
  const rows = await db.getAllAsync<WorkdayRow>(
    'SELECT * FROM workday WHERE ref_date BETWEEN ? AND ? ORDER BY ref_date DESC',
    start,
    end,
  );
  return attachPunches(db, rows.map(toWorkday));
}

export async function getWorkday(db: SQLiteDatabase, id: string): Promise<WorkdayWithPunches | null> {
  const row = await db.getFirstAsync<WorkdayRow>('SELECT * FROM workday WHERE id = ?', id);
  if (!row) return null;
  const [withPunches] = await attachPunches(db, [toWorkday(row)]);
  return withPunches;
}

/** Batida de início do dia: cria a jornada aberta e a primeira ENTRADA */
export async function startWorkday(db: SQLiteDatabase, at: number, source: PunchSource): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO workday (id, ref_date, status, note, created_at, updated_at) VALUES (?, ?, 'open', NULL, ?, ?)",
      id,
      toDateKey(at),
      now,
      now,
    );
    await insertPunch(db, { workdayId: id, kind: 'in', at, isDayStart: true, isDayEnd: false, source });
  });
  return id;
}

export async function insertPunch(
  db: SQLiteDatabase,
  p: { workdayId: string; kind: PunchKind; at: number; isDayStart: boolean; isDayEnd: boolean; source: PunchSource },
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO punch (id, workday_id, kind, at, tz, is_day_start, is_day_end, original_at, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    id,
    p.workdayId,
    p.kind,
    p.at,
    deviceTimeZone(),
    p.isDayStart ? 1 : 0,
    p.isDayEnd ? 1 : 0,
    p.source,
    now,
    now,
  );
  return id;
}

/** Fecha a jornada marcando a batida informada como fim do dia */
export async function closeWorkday(db: SQLiteDatabase, workdayId: string, endPunchId: string): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE punch SET is_day_end = 0, updated_at = ? WHERE workday_id = ?', now, workdayId);
    await db.runAsync('UPDATE punch SET is_day_end = 1, updated_at = ? WHERE id = ?', now, endPunchId);
    await db.runAsync("UPDATE workday SET status = 'closed', updated_at = ? WHERE id = ?", now, workdayId);
  });
}

/** Edição de horário (R9/ED7): preserva o horário original só na primeira edição */
export async function updatePunchTime(db: SQLiteDatabase, punchId: string, at: number): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE punch SET original_at = COALESCE(original_at, at), at = ?, updated_at = ? WHERE id = ?',
      at,
      now,
      punchId,
    );
    // ED8: se for a batida de início, a data de referência acompanha
    await db.runAsync(
      `UPDATE workday SET ref_date = ?, updated_at = ?
       WHERE id = (SELECT workday_id FROM punch WHERE id = ? AND is_day_start = 1)`,
      toDateKey(at),
      now,
      punchId,
    );
  });
}

/** "Voltar ao original" (ED7) */
export async function restorePunchTime(db: SQLiteDatabase, punchId: string): Promise<void> {
  const row = await db.getFirstAsync<{ original_at: number | null }>('SELECT original_at FROM punch WHERE id = ?', punchId);
  if (row?.original_at == null) return;
  await updatePunchTime(db, punchId, row.original_at);
  await db.runAsync('UPDATE punch SET original_at = NULL WHERE id = ?', punchId);
}

export async function deletePunch(db: SQLiteDatabase, punchId: string): Promise<void> {
  await db.runAsync('DELETE FROM punch WHERE id = ?', punchId);
}

export async function deleteWorkday(db: SQLiteDatabase, workdayId: string): Promise<void> {
  await db.runAsync('DELETE FROM workday WHERE id = ?', workdayId);
}

export async function setWorkdayStatus(db: SQLiteDatabase, workdayId: string, status: WorkdayStatus): Promise<void> {
  await db.runAsync('UPDATE workday SET status = ?, updated_at = ? WHERE id = ?', status, Date.now(), workdayId);
}

/** Últimas jornadas, da mais recente para a mais antiga (tela Hoje) */
export async function listRecentWorkdays(db: SQLiteDatabase, limit: number): Promise<WorkdayWithPunches[]> {
  const rows = await db.getAllAsync<WorkdayRow>('SELECT * FROM workday ORDER BY ref_date DESC, created_at DESC LIMIT ?', limit);
  return attachPunches(db, rows.map(toWorkday));
}

export async function countIncompleteWorkdays(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM workday WHERE status = 'incomplete'");
  return row?.n ?? 0;
}

/**
 * Fim da jornada anterior e início da próxima (R4): uma batida não pode invadir outra jornada.
 * `pivot` é o início desta jornada (ou o horário proposto, para uma jornada nova).
 */
export async function getNeighborBounds(
  db: SQLiteDatabase,
  pivot: number,
  excludeWorkdayId: string | null,
): Promise<{ previousWorkdayEnd: number | null; nextWorkdayStart: number | null }> {
  const row = await db.getFirstAsync<{ prev_end: number | null; next_start: number | null }>(
    `WITH w AS (SELECT workday_id, MIN(at) AS s, MAX(at) AS e FROM punch WHERE workday_id IS NOT ? GROUP BY workday_id)
     SELECT (SELECT MAX(e) FROM w WHERE s <= ?) AS prev_end, (SELECT MIN(s) FROM w WHERE s > ?) AS next_start`,
    excludeWorkdayId,
    pivot,
    pivot,
  );
  return { previousWorkdayEnd: row?.prev_end ?? null, nextWorkdayStart: row?.next_start ?? null };
}

// ---- Snapshots: base do "Desfazer" (R7, ED6) -------------------------------------------------

export type WorkdaySnapshot = { workday: WorkdayRow & { created_at: number; updated_at: number }; punches: (PunchRow & { created_at: number; updated_at: number })[] };

export async function snapshotWorkday(db: SQLiteDatabase, workdayId: string): Promise<WorkdaySnapshot | null> {
  const workday = await db.getFirstAsync<WorkdaySnapshot['workday']>('SELECT * FROM workday WHERE id = ?', workdayId);
  if (!workday) return null;
  const punches = await db.getAllAsync<WorkdaySnapshot['punches'][number]>('SELECT * FROM punch WHERE workday_id = ?', workdayId);
  return { workday, punches };
}

/** Volta a jornada exatamente ao snapshot (null = a jornada não existia) */
export async function restoreWorkday(db: SQLiteDatabase, workdayId: string, snapshot: WorkdaySnapshot | null): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workday WHERE id = ?', workdayId);
    if (!snapshot) return;
    const w = snapshot.workday;
    await db.runAsync(
      'INSERT INTO workday (id, ref_date, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      w.id, w.ref_date, w.status, w.note, w.created_at, w.updated_at,
    );
    for (const p of snapshot.punches) {
      await db.runAsync(
        `INSERT INTO punch (id, workday_id, kind, at, tz, is_day_start, is_day_end, original_at, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.workday_id, p.kind, p.at, p.tz, p.is_day_start, p.is_day_end, p.original_at, p.source, p.created_at, p.updated_at,
      );
    }
  });
}

/** Cria uma jornada já com as batidas informadas (jornada manual, R11) */
export async function createWorkdayWithPunches(
  db: SQLiteDatabase,
  punches: { kind: PunchKind; at: number }[],
  { closed, source }: { closed: boolean; source: PunchSource },
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  const sorted = [...punches].sort((a, b) => a.at - b.at);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO workday (id, ref_date, status, note, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      id, toDateKey(sorted[0].at), closed ? 'closed' : 'open', now, now,
    );
    for (const [i, p] of sorted.entries()) {
      await insertPunch(db, {
        workdayId: id,
        kind: p.kind,
        at: p.at,
        isDayStart: i === 0,
        isDayEnd: closed && i === sorted.length - 1,
        source,
      });
    }
  });
  await normalizeWorkday(db, id);
  return id;
}

export async function setWorkdayNote(db: SQLiteDatabase, workdayId: string, note: string | null): Promise<void> {
  await db.runAsync('UPDATE workday SET note = ?, updated_at = ? WHERE id = ?', note, Date.now(), workdayId);
}

/**
 * Recalcula marcas de início/fim e o status depois de qualquer edição:
 * - a primeira batida é sempre o início do dia (e define a data de referência);
 * - jornada encerrada continua encerrada se a última batida ainda for SAÍDA;
 * - sequência inválida → 'incomplete'; sem fim → 'open' se for a mais recente, senão 'incomplete';
 * - sem batidas → a jornada é removida.
 */
export async function normalizeWorkday(db: SQLiteDatabase, workdayId: string): Promise<void> {
  const workday = await getWorkday(db, workdayId);
  if (!workday) return;
  const punches = workday.punches;
  if (punches.length === 0) {
    await deleteWorkday(db, workdayId);
    return;
  }

  const first = punches[0];
  const last = punches[punches.length - 1];
  const alternates = punches.every((p, i) => p.kind === (i % 2 === 0 ? 'in' : 'out'));
  const wasEnded = workday.status === 'closed' || punches.some((p) => p.isDayEnd);
  const ended = alternates && wasEnded && last.kind === 'out';

  const later = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workday w WHERE w.id != ? AND (SELECT MIN(at) FROM punch WHERE workday_id = w.id) > ?`,
    workdayId,
    first.at,
  );
  const isLatest = (later?.n ?? 0) === 0;
  const status: WorkdayStatus = !alternates ? 'incomplete' : ended ? 'closed' : isLatest ? 'open' : 'incomplete';

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE punch SET is_day_start = (id = ?), is_day_end = (id = ? AND ?), updated_at = ? WHERE workday_id = ?',
      first.id, last.id, ended ? 1 : 0, now, workdayId,
    );
    await db.runAsync(
      'UPDATE workday SET status = ?, ref_date = ?, updated_at = ? WHERE id = ?',
      status, toDateKey(first.at), now, workdayId,
    );
  });
}
