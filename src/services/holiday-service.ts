import type { SQLiteDatabase } from 'expo-sqlite';

import { holidaysInRange } from '@/domain/holidays';
import { fromDateKey } from '@/domain/time';
import type { DateKey } from '@/domain/types';
import { addCustomHoliday, deleteCustomHoliday, disableHoliday, enableHoliday, listHolidayOverrides } from '@/db/holiday-repo';
import { bumpData } from '@/stores/data-store';

import type { Undo } from './punch-service';

// Feriado como propriedade do dia, não como folga: o dia continua aceitando jornada.
// Ligar = feriado próprio só daquela data (ex.: municipal). Desligar = apaga o feriado próprio
// daquela data ou desativa o nacional/recorrente só naquele ano.

export const LOCAL_HOLIDAY_NAME = 'Feriado local';

export async function setHolidayOnDates(
  db: SQLiteDatabase,
  dates: readonly DateKey[],
  on: boolean,
  { includeOptional = false, name = LOCAL_HOLIDAY_NAME } = {},
): Promise<Undo> {
  const sorted = [...dates].sort();
  const overrides = await listHolidayOverrides(db);
  const current = holidaysInRange(sorted[0], sorted.at(-1)!, overrides, { includeOptional });
  const undos: Undo[] = [];

  for (const date of sorted) {
    const holiday = current.get(date);
    if (on && !holiday) {
      const id = await addCustomHoliday(db, { name, date, recurring: false });
      undos.push(() => deleteCustomHoliday(db, id));
    } else if (!on && holiday) {
      const customId = holiday.key.startsWith('custom:') ? holiday.key.slice('custom:'.length) : null;
      const custom = customId ? overrides.find((o) => o.kind === 'custom' && o.id === customId) : undefined;
      if (custom && custom.kind === 'custom' && custom.date === date) {
        // Feriado próprio só desta data: some de vez (e volta igual no desfazer)
        await deleteCustomHoliday(db, custom.id);
        undos.push(async () => {
          await addCustomHoliday(db, { id: custom.id, name: custom.name, date, recurring: false });
        });
      } else {
        const year = fromDateKey(date).getFullYear();
        await disableHoliday(db, holiday.key, year);
        undos.push(() => enableHoliday(db, holiday.key, year));
      }
    }
  }
  bumpData();

  return async () => {
    for (const undo of undos.reverse()) await undo();
    bumpData();
  };
}
