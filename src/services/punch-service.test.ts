import type { SQLiteDatabase } from 'expo-sqlite';

import { exportData, importData } from '@/db/backup-repo';
import { listDayOffs } from '@/db/day-off-repo';
import { getOpenWorkday, getWorkday, listWorkdays } from '@/db/workday-repo';
import { HOUR, MINUTE } from '@/domain/time';
import { summarizeWorkday } from '@/domain/workday';
import { createMemoryDb } from '@/test/memory-db';

import {
  addPunchesToWorkday,
  copyWorkdayToDates,
  findLastCompleteWorkday,
  createManualWorkday,
  editPunchTime,
  getEditContext,
  performDayAction,
  removePunch,
  restoreOriginalTime,
  RuleError,
  setDayOffs,
} from './punch-service';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));

const t = (iso: string) => new Date(iso).getTime();

let db: SQLiteDatabase;

beforeEach(async () => {
  jest.useFakeTimers({ now: t('2026-10-14T12:00:00'), doNotFake: ['nextTick', 'setImmediate'] });
  db = await createMemoryDb();
});

afterEach(() => jest.useRealTimers());

async function dayB() {
  // Exemplo B: 04–09, 17–20, 23–02 (+1)
  jest.setSystemTime(t('2026-10-14T06:00:00'));
  await performDayAction(db, 'startDay', { at: t('2026-10-13T04:00:00') });
  await performDayAction(db, 'pause', { at: t('2026-10-13T09:00:00') });
  await performDayAction(db, 'resume', { at: t('2026-10-13T17:00:00') });
  await performDayAction(db, 'pause', { at: t('2026-10-13T20:00:00') });
  await performDayAction(db, 'resume', { at: t('2026-10-13T23:00:00') });
  return performDayAction(db, 'endDay', { at: t('2026-10-14T02:00:00') });
}

describe('bater o ponto', () => {
  it('exemplo B vira uma única jornada de 13/10 com 11h', async () => {
    const result = await dayB();
    const w = (await getWorkday(db, result.workdayId))!;
    expect(w.refDate).toBe('2026-10-13');
    expect(w.status).toBe('closed');
    expect(w.punches[0].isDayStart).toBe(true);
    expect(w.punches.at(-1)!.isDayEnd).toBe(true);
    expect(summarizeWorkday(w.punches).workedMs).toBe(11 * HOUR);
    expect(await getOpenWorkday(db)).toBeNull();
  });

  it('encerrar no intervalo usa a última saída como fim do dia', async () => {
    await performDayAction(db, 'startDay', { at: t('2026-10-14T08:00:00') });
    await performDayAction(db, 'pause', { at: t('2026-10-14T11:00:00') });
    const r = await performDayAction(db, 'endDay');
    const w = (await getWorkday(db, r.workdayId))!;
    expect(w.punches).toHaveLength(2);
    expect(w.status).toBe('closed');
  });

  it('não aceita horário antes da última batida nem no futuro', async () => {
    await performDayAction(db, 'startDay', { at: t('2026-10-14T08:00:00') });
    await expect(performDayAction(db, 'pause', { at: t('2026-10-14T07:00:00') })).rejects.toThrow(RuleError);
    await expect(performDayAction(db, 'pause', { at: t('2026-10-14T13:00:00') })).rejects.toThrow(RuleError);
  });

  it('não deixa iniciar um dia antes do fim do anterior', async () => {
    await dayB();
    await expect(performDayAction(db, 'startDay', { at: t('2026-10-14T01:00:00') })).rejects.toThrow(/terminou/);
  });

  it('desfazer remove a batida (e a jornada, se era o início)', async () => {
    const start = await performDayAction(db, 'startDay', { at: t('2026-10-14T08:00:00') });
    const pause = await performDayAction(db, 'pause', { at: t('2026-10-14T11:00:00') });
    await pause.undo();
    expect((await getOpenWorkday(db))!.punches).toHaveLength(1);
    await start.undo();
    expect(await getOpenWorkday(db)).toBeNull();
  });
});

describe('edição de horário', () => {
  it('pausa 15:45 → 15:43 atualiza totais, guarda o original e pode voltar', async () => {
    jest.setSystemTime(t('2026-10-14T18:00:00'));
    await performDayAction(db, 'startDay', { at: t('2026-10-14T08:00:00') });
    const pause = await performDayAction(db, 'pause', { at: t('2026-10-14T15:45:00') });

    const undo = await editPunchTime(db, pause.punchId, t('2026-10-14T15:43:00'));
    let w = (await getWorkday(db, pause.workdayId))!;
    expect(w.punches[1].at).toBe(t('2026-10-14T15:43:00'));
    expect(w.punches[1].originalAt).toBe(t('2026-10-14T15:45:00'));
    expect(summarizeWorkday(w.punches).workedMs).toBe(7 * HOUR + 43 * MINUTE);

    await undo();
    w = (await getWorkday(db, pause.workdayId))!;
    expect(w.punches[1].at).toBe(t('2026-10-14T15:45:00'));
    expect(w.punches[1].originalAt).toBeNull();

    await editPunchTime(db, pause.punchId, t('2026-10-14T15:40:00'));
    await editPunchTime(db, pause.punchId, t('2026-10-14T15:41:00'));
    await restoreOriginalTime(db, pause.punchId);
    w = (await getWorkday(db, pause.workdayId))!;
    expect(w.punches[1].at).toBe(t('2026-10-14T15:45:00'));
    expect(w.punches[1].originalAt).toBeNull();
  });

  it('limites: não passa da batida vizinha nem invade a jornada anterior', async () => {
    await dayB();
    jest.setSystemTime(t('2026-10-14T18:00:00'));
    const start = await performDayAction(db, 'startDay', { at: t('2026-10-14T14:00:00') });
    const ctx = (await getEditContext(db, start.punchId))!;
    expect(ctx.bounds.min).toBe(t('2026-10-14T02:01:00'));
    await expect(editPunchTime(db, start.punchId, t('2026-10-14T01:00:00'))).rejects.toThrow(RuleError);
  });

  it('mover o início do dia para a véspera muda a data de referência (ED8)', async () => {
    jest.setSystemTime(t('2026-10-14T10:00:00'));
    const start = await performDayAction(db, 'startDay', { at: t('2026-10-14T00:10:00') });
    await editPunchTime(db, start.punchId, t('2026-10-13T23:50:00'));
    expect((await getWorkday(db, start.workdayId))!.refDate).toBe('2026-10-13');
  });

  it('excluir a última saída de uma jornada antiga a deixa incompleta; adicionar corrige', async () => {
    const end = await dayB();
    jest.setSystemTime(t('2026-10-14T18:00:00'));
    await performDayAction(db, 'startDay', { at: t('2026-10-14T14:00:00') });

    await removePunch(db, end.punchId);
    expect((await getWorkday(db, end.workdayId))!.status).toBe('incomplete');

    await addPunchesToWorkday(db, end.workdayId, [{ kind: 'out', at: t('2026-10-14T02:30:00') }]);
    const w = (await getWorkday(db, end.workdayId))!;
    expect(w.status).toBe('incomplete'); // sem fim do dia marcado, mas consistente
    expect(summarizeWorkday(w.punches).isConsistent).toBe(true);
  });
});

describe('jornada manual e folgas', () => {
  it('cria jornada que passa da meia-noite e recusa sobreposição', async () => {
    const { workdayId } = await createManualWorkday(db, [
      { start: t('2026-10-10T22:00:00'), end: t('2026-10-11T03:00:00') },
    ]);
    expect((await getWorkday(db, workdayId))!.refDate).toBe('2026-10-10');
    await expect(
      createManualWorkday(db, [{ start: t('2026-10-11T01:00:00'), end: t('2026-10-11T05:00:00') }]),
    ).rejects.toThrow(RuleError);
  });

  it('F2: folga em dia com jornada exige confirmação e pode ser desfeita', async () => {
    const { workdayId } = await createManualWorkday(db, [{ start: t('2026-10-10T08:00:00'), end: t('2026-10-10T12:00:00') }]);
    await expect(setDayOffs(db, ['2026-10-10'], 'folga')).rejects.toThrow(RuleError);

    const undo = await setDayOffs(db, ['2026-10-10', '2026-10-11'], 'ferias', { replaceWorkdays: true });
    expect(await getWorkday(db, workdayId)).toBeNull();
    expect((await listDayOffs(db, '2026-10-01', '2026-10-31')).map((d) => d.kind)).toEqual(['ferias', 'ferias']);

    await undo();
    expect(await getWorkday(db, workdayId)).not.toBeNull();
    expect(await listDayOffs(db, '2026-10-01', '2026-10-31')).toEqual([]);
  });
});

it('backup: exportar → importar em outro banco preserva tudo', async () => {
  await dayB();
  await setDayOffs(db, ['2026-10-11'], 'folga');
  const data = await exportData(db);

  const other = await createMemoryDb();
  await importData(other, data);
  expect(await exportData(other)).toEqual(data);
  expect(await listWorkdays(other, '2026-10-01', '2026-10-31')).toHaveLength(1);
});

describe('copiar jornada', () => {
  it('copia para vários dias, pulando folga, o próprio dia e conflitos; desfazer remove tudo', async () => {
    const end = await dayB(); // jornada de 13/10, 04:00 → 02:00 (+1)
    await setDayOffs(db, ['2026-10-11'], 'folga');
    // conflito: jornada que invade 06/10 → 07/10 01:00
    await createManualWorkday(db, [{ start: t('2026-10-07T00:30:00'), end: t('2026-10-07T03:00:00') }]);

    const result = await copyWorkdayToDates(db, end.workdayId, ['2026-10-05', '2026-10-06', '2026-10-11', '2026-10-13']);
    expect(result.created.map((c) => c.date)).toEqual(['2026-10-05']);
    expect(result.skipped.map((s) => s.date)).toEqual(['2026-10-06', '2026-10-11', '2026-10-13']);

    const copy = (await getWorkday(db, result.created[0].workdayId))!;
    expect(copy.refDate).toBe('2026-10-05');
    expect(copy.status).toBe('closed');
    expect(summarizeWorkday(copy.punches).workedMs).toBe(11 * HOUR);
    expect(copy.punches.at(-1)!.at).toBe(t('2026-10-06T02:00:00'));

    await result.undo();
    expect(await getWorkday(db, result.created[0].workdayId)).toBeNull();
  });

  it('não copia jornada em andamento', async () => {
    const start = await performDayAction(db, 'startDay', { at: t('2026-10-14T08:00:00') });
    await expect(copyWorkdayToDates(db, start.workdayId, ['2026-10-13'])).rejects.toThrow(RuleError);
  });

  it('acha a última jornada completa antes de uma data', async () => {
    const end = await dayB();
    expect((await findLastCompleteWorkday(db, '2026-10-20'))!.id).toBe(end.workdayId);
    expect(await findLastCompleteWorkday(db, '2026-10-13')).toBeNull();
  });
});
