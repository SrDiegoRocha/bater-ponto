import type { SQLiteDatabase } from 'expo-sqlite';

import { copyShifts } from '@/domain/copy-workday';
import { templateToShifts, type ShiftTemplate } from '@/domain/templates';
import { deriveDayState, transition, type DayAction } from '@/domain/state-machine';
import { MINUTE } from '@/domain/time';
import type { DateKey, DayOffKind, Punch, PunchKind, PunchSource } from '@/domain/types';
import { editBounds, FUTURE_TOLERANCE_MS, isWithinBounds, type EditBounds } from '@/domain/validation';
import { deleteDayOffs, listDayOffs, upsertDayOffs } from '@/db/day-off-repo';
import {
  closeWorkday,
  createWorkdayWithPunches,
  deletePunch,
  getNeighborBounds,
  getOpenWorkday,
  getWorkday,
  insertPunch,
  listWorkdays,
  normalizeWorkday,
  restorePunchTime,
  restoreWorkday,
  snapshotWorkday,
  startWorkday,
  updatePunchTime,
  type WorkdaySnapshot,
  type WorkdayWithPunches,
} from '@/db/workday-repo';
import { formatTime } from '@/lib/format';
import { bumpData } from '@/stores/data-store';

// Casos de uso de jornadas e batidas: aplicam as regras do domínio, gravam e devolvem o "Desfazer".

export class RuleError extends Error {}

export type Undo = () => Promise<void>;

function undoTo(db: SQLiteDatabase, snapshots: Map<string, WorkdaySnapshot | null>): Undo {
  return async () => {
    for (const [id, snapshot] of snapshots) await restoreWorkday(db, id, snapshot);
    bumpData();
  };
}

// ---- Bater o ponto (§3.1) ----------------------------------------------------------------------

export type DayActionResult = { workdayId: string; punchId: string; undo: Undo };

/** Limites para bater o ponto com outro horário (R8): depois da última batida e nunca no futuro */
export async function getActionBounds(db: SQLiteDatabase, now = Date.now()): Promise<EditBounds> {
  const open = await getOpenWorkday(db);
  if (open && open.punches.length) return { min: open.punches.at(-1)!.at + MINUTE, max: now };
  const { previousWorkdayEnd } = await getNeighborBounds(db, now, null);
  return { min: previousWorkdayEnd != null ? previousWorkdayEnd + MINUTE : null, max: now };
}

export async function performDayAction(
  db: SQLiteDatabase,
  action: DayAction,
  { at = Date.now(), source = 'live' as PunchSource } = {},
): Promise<DayActionResult> {
  const now = Date.now();
  if (at > now + FUTURE_TOLERANCE_MS) throw new RuleError('Não dá para bater o ponto no futuro.');

  const open = await getOpenWorkday(db);
  const effect = transition(deriveDayState(open?.punches ?? null), action);
  const last = open?.punches.at(-1);

  if (effect.type === 'markLastAsDayEnd') {
    const snapshot = await snapshotWorkday(db, open!.id);
    await closeWorkday(db, open!.id, last!.id);
    bumpData();
    return { workdayId: open!.id, punchId: last!.id, undo: undoTo(db, new Map([[open!.id, snapshot]])) };
  }

  if (last && at <= last.at) {
    throw new RuleError(`Esse horário é antes da última batida (${formatTime(last.at)}). Escolha um horário depois dele.`);
  }

  if (effect.opensWorkday) {
    const { previousWorkdayEnd, nextWorkdayStart } = await getNeighborBounds(db, at, null);
    if (previousWorkdayEnd != null && at <= previousWorkdayEnd) {
      throw new RuleError(`O dia anterior terminou às ${formatTime(previousWorkdayEnd)}. Escolha um horário depois.`);
    }
    if (nextWorkdayStart != null) throw new RuleError('Já existe uma jornada depois desse horário.');
    const workdayId = await startWorkday(db, at, source);
    const created = await getWorkday(db, workdayId);
    bumpData();
    return { workdayId, punchId: created!.punches[0].id, undo: undoTo(db, new Map([[workdayId, null]])) };
  }

  const snapshot = await snapshotWorkday(db, open!.id);
  const punchId = await insertPunch(db, {
    workdayId: open!.id,
    kind: effect.kind,
    at,
    isDayStart: false,
    isDayEnd: effect.isDayEnd,
    source,
  });
  if (effect.isDayEnd) await closeWorkday(db, open!.id, punchId);
  bumpData();
  return { workdayId: open!.id, punchId, undo: undoTo(db, new Map([[open!.id, snapshot]])) };
}

// ---- Edição de horário (§3.11) -----------------------------------------------------------------

export type EditContext = {
  punch: Punch;
  workday: WorkdayWithPunches;
  index: number;
  bounds: EditBounds;
};

export async function getEditContext(db: SQLiteDatabase, punchId: string, now = Date.now()): Promise<EditContext | null> {
  const row = await db.getFirstAsync<{ workday_id: string }>('SELECT workday_id FROM punch WHERE id = ?', punchId);
  if (!row) return null;
  const workday = await getWorkday(db, row.workday_id);
  if (!workday) return null;
  const index = workday.punches.findIndex((p) => p.id === punchId);
  const neighbors = await getNeighborBounds(db, workday.punches[0].at, workday.id);
  return { punch: workday.punches[index], workday, index, bounds: editBounds(workday.punches, index, { now, ...neighbors }) };
}

export async function editPunchTime(db: SQLiteDatabase, punchId: string, at: number): Promise<Undo> {
  const ctx = await getEditContext(db, punchId);
  if (!ctx) throw new RuleError('Batida não encontrada.');
  if (!isWithinBounds(at, ctx.bounds)) throw new RuleError('Esse horário invade outra batida ou está no futuro.');
  const snapshot = await snapshotWorkday(db, ctx.workday.id);
  await updatePunchTime(db, punchId, at);
  await normalizeWorkday(db, ctx.workday.id);
  bumpData();
  return undoTo(db, new Map([[ctx.workday.id, snapshot]]));
}

/** "Voltar ao original" (ED7) */
export async function restoreOriginalTime(db: SQLiteDatabase, punchId: string): Promise<Undo> {
  const ctx = await getEditContext(db, punchId);
  if (!ctx) throw new RuleError('Batida não encontrada.');
  const snapshot = await snapshotWorkday(db, ctx.workday.id);
  await restorePunchTime(db, punchId);
  await normalizeWorkday(db, ctx.workday.id);
  bumpData();
  return undoTo(db, new Map([[ctx.workday.id, snapshot]]));
}

export async function removePunch(db: SQLiteDatabase, punchId: string): Promise<Undo> {
  const ctx = await getEditContext(db, punchId);
  if (!ctx) throw new RuleError('Batida não encontrada.');
  const snapshot = await snapshotWorkday(db, ctx.workday.id);
  await deletePunch(db, punchId);
  await normalizeWorkday(db, ctx.workday.id);
  bumpData();
  return undoTo(db, new Map([[ctx.workday.id, snapshot]]));
}

// ---- Turnos e jornadas manuais -----------------------------------------------------------------

type NewPunch = { kind: PunchKind; at: number };

function assertAlternating(punches: readonly NewPunch[]) {
  const sorted = [...punches].sort((a, b) => a.at - b.at);
  sorted.forEach((p, i) => {
    if (i > 0 && p.at === sorted[i - 1].at) throw new RuleError('Duas batidas no mesmo horário.');
    if (p.kind !== (i % 2 === 0 ? 'in' : 'out')) {
      throw new RuleError('As batidas precisam alternar entre entrada e saída. Confira os horários.');
    }
  });
}

/** Adiciona batidas a uma jornada (turno esquecido, volta do intervalo que faltou…) */
export async function addPunchesToWorkday(db: SQLiteDatabase, workdayId: string, added: NewPunch[]): Promise<Undo> {
  const workday = await getWorkday(db, workdayId);
  if (!workday) throw new RuleError('Jornada não encontrada.');
  const now = Date.now();
  if (added.some((p) => p.at > now + FUTURE_TOLERANCE_MS)) throw new RuleError('Não dá para registrar horário no futuro.');
  const all = [...workday.punches, ...added];
  assertAlternatingAllowingOpen(all);

  const start = Math.min(...all.map((p) => p.at));
  const end = Math.max(...all.map((p) => p.at));
  const { previousWorkdayEnd, nextWorkdayStart } = await getNeighborBounds(db, workday.punches[0]?.at ?? start, workdayId);
  if (previousWorkdayEnd != null && start <= previousWorkdayEnd) throw new RuleError('Esse horário invade a jornada anterior.');
  if (nextWorkdayStart != null && end >= nextWorkdayStart) throw new RuleError('Esse horário invade a próxima jornada.');

  const snapshot = await snapshotWorkday(db, workdayId);
  for (const p of added) {
    await insertPunch(db, { workdayId, kind: p.kind, at: p.at, isDayStart: false, isDayEnd: false, source: 'manual' });
  }
  await normalizeWorkday(db, workdayId);
  bumpData();
  return undoTo(db, new Map([[workdayId, snapshot]]));
}

/** Jornada aberta pode terminar em ENTRADA; o resto precisa alternar começando por ENTRADA */
function assertAlternatingAllowingOpen(punches: readonly NewPunch[]) {
  assertAlternating(punches.length % 2 === 1 ? [...punches, { kind: 'out', at: Number.MAX_SAFE_INTEGER }] : punches);
}

/** Jornada inteira cadastrada à mão (R11) */
export async function createManualWorkday(
  db: SQLiteDatabase,
  shifts: { start: number; end: number }[],
): Promise<{ workdayId: string; undo: Undo }> {
  const punches = shifts.flatMap((s) => [
    { kind: 'in' as const, at: s.start },
    { kind: 'out' as const, at: s.end },
  ]);
  assertAlternating(punches);
  const now = Date.now();
  if (punches.some((p) => p.at > now + FUTURE_TOLERANCE_MS)) throw new RuleError('Não dá para registrar horário no futuro.');
  const start = Math.min(...punches.map((p) => p.at));
  const end = Math.max(...punches.map((p) => p.at));
  const { previousWorkdayEnd, nextWorkdayStart } = await getNeighborBounds(db, start, null);
  if (previousWorkdayEnd != null && start <= previousWorkdayEnd) throw new RuleError('Esse horário invade a jornada anterior.');
  if (nextWorkdayStart != null && end >= nextWorkdayStart) throw new RuleError('Esse horário invade a próxima jornada.');

  const workdayId = await createWorkdayWithPunches(db, punches, { closed: true, source: 'manual' });
  bumpData();
  return { workdayId, undo: undoTo(db, new Map([[workdayId, null]])) };
}

/** Marca a última SAÍDA como fim do dia (corrige jornada esquecida aberta/incompleta) */
export async function endWorkdayAtLastPunch(db: SQLiteDatabase, workdayId: string): Promise<Undo> {
  const workday = await getWorkday(db, workdayId);
  const last = workday?.punches.at(-1);
  if (!workday || !last || last.kind !== 'out') throw new RuleError('A jornada precisa terminar com uma saída.');
  const snapshot = await snapshotWorkday(db, workdayId);
  await closeWorkday(db, workdayId, last.id);
  await normalizeWorkday(db, workdayId);
  bumpData();
  return undoTo(db, new Map([[workdayId, snapshot]]));
}

export async function removeWorkday(db: SQLiteDatabase, workdayId: string): Promise<Undo> {
  const snapshot = await snapshotWorkday(db, workdayId);
  await db.runAsync('DELETE FROM workday WHERE id = ?', workdayId);
  bumpData();
  return undoTo(db, new Map([[workdayId, snapshot]]));
}

// ---- Folgas (§3.3) -----------------------------------------------------------------------------

/** Jornadas que começam nas datas informadas (F2: conflito com folga) */
export async function findWorkdaysOnDates(db: SQLiteDatabase, dates: readonly DateKey[]): Promise<WorkdayWithPunches[]> {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const all = await listWorkdays(db, sorted[0], sorted.at(-1)!);
  return all.filter((w) => dates.includes(w.refDate));
}

export async function setDayOffs(
  db: SQLiteDatabase,
  dates: readonly DateKey[],
  kind: DayOffKind,
  { note = null as string | null, replaceWorkdays = false } = {},
): Promise<Undo> {
  const sorted = [...dates].sort();
  const previous = await listDayOffs(db, sorted[0], sorted.at(-1)!);
  const conflicts = await findWorkdaysOnDates(db, dates);
  if (conflicts.length && !replaceWorkdays) throw new RuleError('Há jornadas nessas datas.');

  const snapshots = new Map<string, WorkdaySnapshot | null>();
  for (const w of conflicts) snapshots.set(w.id, await snapshotWorkday(db, w.id));
  for (const w of conflicts) await db.runAsync('DELETE FROM workday WHERE id = ?', w.id);
  await upsertDayOffs(db, dates, kind, note);
  bumpData();

  const restoreWorkdays = undoTo(db, snapshots);
  return async () => {
    await deleteDayOffs(db, dates);
    for (const d of previous.filter((p) => dates.includes(p.date))) await upsertDayOffs(db, [d.date], d.kind, d.note);
    await restoreWorkdays();
  };
}

export async function clearDayOffs(db: SQLiteDatabase, dates: readonly DateKey[]): Promise<Undo> {
  const sorted = [...dates].sort();
  const previous = (await listDayOffs(db, sorted[0], sorted.at(-1)!)).filter((d) => dates.includes(d.date));
  await deleteDayOffs(db, dates);
  bumpData();
  return async () => {
    for (const d of previous) await upsertDayOffs(db, [d.date], d.kind, d.note);
    bumpData();
  };
}

// ---- Copiar jornada para outros dias -----------------------------------------------------------

export type CopyResult = {
  created: { date: DateKey; workdayId: string }[];
  skipped: { date: DateKey; reason: string }[];
  undo: Undo;
};

/**
 * Cria jornadas em várias datas a partir de turnos calculados por data.
 * Dias com folga, a data excluída e dias com conflito (sobreposição, futuro) são pulados e reportados.
 */
async function applyShiftsToDates(
  db: SQLiteDatabase,
  dates: readonly DateKey[],
  shiftsFor: (date: DateKey) => { start: number; end: number }[],
  excludeDate: DateKey | null,
): Promise<CopyResult> {
  const sorted = [...new Set(dates)].sort();
  const dayOffs = sorted.length ? await listDayOffs(db, sorted[0], sorted.at(-1)!) : [];
  const created: CopyResult['created'] = [];
  const skipped: CopyResult['skipped'] = [];

  for (const date of sorted) {
    if (date === excludeDate) {
      skipped.push({ date, reason: 'é o próprio dia da jornada' });
      continue;
    }
    if (dayOffs.some((d) => d.date === date)) {
      skipped.push({ date, reason: 'está marcado como folga' });
      continue;
    }
    try {
      const { workdayId: id } = await createManualWorkday(db, shiftsFor(date));
      created.push({ date, workdayId: id });
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      skipped.push({ date, reason: e.message.replace(/.$/, '').toLowerCase() });
    }
  }

  return { created, skipped, undo: undoTo(db, new Map(created.map((c) => [c.workdayId, null]))) };
}

/** Copia os turnos de uma jornada completa para outras datas (mesmos horários de relógio) */
export async function copyWorkdayToDates(db: SQLiteDatabase, workdayId: string, dates: readonly DateKey[]): Promise<CopyResult> {
  const source = await getWorkday(db, workdayId);
  if (!source) throw new RuleError('Jornada não encontrada.');
  if (!copyShifts(source.punches, source.refDate, source.refDate)) {
    throw new RuleError('Só dá para copiar uma jornada completa (todas as entradas com saída).');
  }
  return applyShiftsToDates(db, dates, (date) => copyShifts(source.punches, source.refDate, date)!, source.refDate);
}

/** Aplica uma escala modelo em várias datas */
export async function applyTemplateToDates(db: SQLiteDatabase, template: ShiftTemplate, dates: readonly DateKey[]): Promise<CopyResult> {
  if (template.shifts.length === 0) throw new RuleError('A escala não tem turnos.');
  return applyShiftsToDates(db, dates, (date) => templateToShifts(template, date), null);
}

/** Move todas as batidas da jornada em ±delta (ex.: esqueceu de bater e tudo ficou 10 min atrasado) */
export async function shiftWorkday(db: SQLiteDatabase, workdayId: string, deltaMs: number): Promise<Undo> {
  const workday = await getWorkday(db, workdayId);
  if (!workday || workday.punches.length === 0) throw new RuleError('Jornada não encontrada.');
  if (deltaMs === 0) return async () => {};
  const first = workday.punches[0].at + deltaMs;
  const last = workday.punches.at(-1)!.at + deltaMs;
  if (last > Date.now() + FUTURE_TOLERANCE_MS) throw new RuleError('Assim a jornada terminaria no futuro.');
  const { previousWorkdayEnd, nextWorkdayStart } = await getNeighborBounds(db, workday.punches[0].at, workdayId);
  if (previousWorkdayEnd != null && first <= previousWorkdayEnd) throw new RuleError('Assim a jornada invadiria a anterior.');
  if (nextWorkdayStart != null && last >= nextWorkdayStart) throw new RuleError('Assim a jornada invadiria a próxima.');

  const snapshot = await snapshotWorkday(db, workdayId);
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE punch SET original_at = COALESCE(original_at, at), at = at + ?, updated_at = ? WHERE workday_id = ?',
      deltaMs,
      now,
      workdayId,
    );
  });
  await normalizeWorkday(db, workdayId);
  bumpData();
  return undoTo(db, new Map([[workdayId, snapshot]]));
}

/** Última jornada completa antes de uma data (atalho "copiar a jornada de ontem") */
export async function findLastCompleteWorkday(db: SQLiteDatabase, before: DateKey): Promise<WorkdayWithPunches | null> {
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM workday WHERE status = 'closed' AND ref_date < ? ORDER BY ref_date DESC LIMIT 1",
    before,
  );
  return row ? getWorkday(db, row.id) : null;
}
