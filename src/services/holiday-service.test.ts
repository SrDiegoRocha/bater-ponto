import type { SQLiteDatabase } from 'expo-sqlite';

import { listDayOffs } from '@/db/day-off-repo';
import { listHolidayOverrides } from '@/db/holiday-repo';
import { migrateDbIfNeeded } from '@/db/migrations';
import { holidaysInRange } from '@/domain/holidays';
import { createMemoryDb } from '@/test/memory-db';

import { LOCAL_HOLIDAY_NAME, setHolidayOnDates } from './holiday-service';
import { createManualWorkday } from './punch-service';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));

const t = (iso: string) => new Date(iso).getTime();

let db: SQLiteDatabase;

beforeEach(async () => {
  jest.useFakeTimers({ now: t('2026-10-14T12:00:00'), doNotFake: ['nextTick', 'setImmediate'] });
  db = await createMemoryDb();
});

afterEach(() => jest.useRealTimers());

const holidayOn = async (date: string) => holidaysInRange(date, date, await listHolidayOverrides(db)).get(date) ?? null;

describe('feriado por data', () => {
  it('liga um feriado local só naquela data e desfaz', async () => {
    const undo = await setHolidayOnDates(db, ['2026-10-09'], true);
    expect((await holidayOn('2026-10-09'))?.name).toBe(LOCAL_HOLIDAY_NAME);
    expect(await holidayOn('2027-10-09')).toBeNull(); // não repete no ano seguinte

    await undo();
    expect(await holidayOn('2026-10-09')).toBeNull();
  });

  it('o dia continua aceitando jornada (feriado não é folga)', async () => {
    await setHolidayOnDates(db, ['2026-10-09'], true);
    await createManualWorkday(db, [{ start: t('2026-10-09T08:00'), end: t('2026-10-09T12:00') }]);
    expect(await listDayOffs(db, '2026-10-09', '2026-10-09')).toEqual([]);
    expect(await holidayOn('2026-10-09')).not.toBeNull();
  });

  it('desligar um feriado local apaga o registro (sem lixo) e o desfazer devolve o mesmo', async () => {
    await setHolidayOnDates(db, ['2026-10-09'], true);
    const undo = await setHolidayOnDates(db, ['2026-10-09'], false);
    expect(await listHolidayOverrides(db)).toEqual([]);

    await undo();
    expect((await holidayOn('2026-10-09'))?.name).toBe(LOCAL_HOLIDAY_NAME);
  });

  it('desligar um feriado nacional desativa só naquele ano', async () => {
    const undo = await setHolidayOnDates(db, ['2026-10-12'], false);
    expect(await holidayOn('2026-10-12')).toBeNull();
    expect(await holidayOn('2027-10-12')).not.toBeNull();

    await undo();
    expect(await holidayOn('2026-10-12')).not.toBeNull();
  });

  it('em várias datas, só cria onde ainda não há feriado', async () => {
    await setHolidayOnDates(db, ['2026-10-11', '2026-10-12', '2026-10-13'], true);
    expect((await holidayOn('2026-10-12'))?.name).toBe('Nossa Senhora Aparecida');
    expect((await listHolidayOverrides(db)).filter((o) => o.kind === 'custom')).toHaveLength(2);
  });
});

describe('migração v5', () => {
  it('folga do tipo "feriado" vira feriado da data e libera o dia para jornada', async () => {
    await db.runAsync("INSERT INTO day_off (date, kind, note, created_at) VALUES ('2026-08-15', 'feriado', 'Aniversário da cidade', 0)");
    await db.runAsync("INSERT INTO day_off (date, kind, note, created_at) VALUES ('2026-08-16', 'folga', NULL, 0)");
    await db.execAsync('PRAGMA user_version = 4');

    await migrateDbIfNeeded(db);

    expect((await holidayOn('2026-08-15'))?.name).toBe('Aniversário da cidade');
    expect((await listDayOffs(db, '2026-08-01', '2026-08-31')).map((d) => d.kind)).toEqual(['folga']);
  });
});
