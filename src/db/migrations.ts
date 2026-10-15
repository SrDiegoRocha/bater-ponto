import type { SQLiteDatabase } from 'expo-sqlite';

// Migrações por PRAGMA user_version (PLANEJAMENTO.md §8). Cada passo leva o banco da versão N para N+1
// e roda dentro de uma transação. Nunca editar um passo já publicado — sempre acrescentar um novo.

const steps: ((db: SQLiteDatabase) => Promise<void>)[] = [
  // v0 → v1: esquema inicial
  async (db) => {
    await db.execAsync(`
      CREATE TABLE workday (
        id          TEXT PRIMARY KEY NOT NULL,
        ref_date    TEXT NOT NULL,
        status      TEXT NOT NULL CHECK (status IN ('open', 'closed', 'incomplete')),
        note        TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX idx_workday_ref ON workday(ref_date);
      CREATE INDEX idx_workday_status ON workday(status);

      CREATE TABLE punch (
        id            TEXT PRIMARY KEY NOT NULL,
        workday_id    TEXT NOT NULL REFERENCES workday(id) ON DELETE CASCADE,
        kind          TEXT NOT NULL CHECK (kind IN ('in', 'out')),
        at            INTEGER NOT NULL,
        tz            TEXT NOT NULL,
        is_day_start  INTEGER NOT NULL DEFAULT 0,
        is_day_end    INTEGER NOT NULL DEFAULT 0,
        original_at   INTEGER,
        source        TEXT NOT NULL CHECK (source IN ('live', 'retro', 'manual')),
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );
      CREATE INDEX idx_punch_workday ON punch(workday_id);
      CREATE INDEX idx_punch_at ON punch(at);

      CREATE TABLE day_off (
        date        TEXT PRIMARY KEY NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'folga' CHECK (kind IN ('folga', 'ferias', 'atestado', 'feriado')),
        note        TEXT,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE holiday_override (
        id           TEXT PRIMARY KEY NOT NULL,
        kind         TEXT NOT NULL CHECK (kind IN ('custom', 'disabled')),
        date         TEXT,
        month_day    TEXT,
        year         INTEGER,
        name         TEXT,
        holiday_key  TEXT,
        created_at   INTEGER NOT NULL
      );

      CREATE TABLE setting (
        key    TEXT PRIMARY KEY NOT NULL,
        value  TEXT NOT NULL
      );
    `);
  },

  // v1 → v2: escalas modelo
  async (db) => {
    await db.execAsync(`
      CREATE TABLE shift_template (
        id          TEXT PRIMARY KEY NOT NULL,
        name        TEXT NOT NULL,
        shifts      TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );
    `);
  },
];

export const DATABASE_NAME = 'bater-ponto.db';
export const DATABASE_VERSION = steps.length;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version > DATABASE_VERSION) {
    throw new Error(`Banco na versão ${version}, mais nova que o app (${DATABASE_VERSION}). Atualize o app.`);
  }
  while (version < DATABASE_VERSION) {
    const step = steps[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await step(db);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
