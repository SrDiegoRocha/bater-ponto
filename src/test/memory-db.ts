// Adaptador de testes: implementa o subconjunto de `SQLiteDatabase` (expo-sqlite) que o app usa,
// sobre o SQLite embutido do Node. Assim repositórios e serviços rodam com SQL de verdade no Jest.
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';

import { migrateDbIfNeeded } from '@/db/migrations';

type Params = unknown[];

function flatten(args: unknown[]): Params {
  if (args.length === 1 && Array.isArray(args[0])) return args[0] as Params;
  return args;
}

export async function createMemoryDb(): Promise<SQLiteDatabase> {
  const raw = new DatabaseSync(':memory:');
  const plain = (row: unknown) => (row ? { ...(row as object) } : null);

  const db = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const r = raw.prepare(sql).run(...(flatten(args) as never[]));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllAsync: async (sql: string, ...args: unknown[]) =>
      raw.prepare(sql).all(...(flatten(args) as never[])).map((r) => plain(r)),
    getFirstAsync: async (sql: string, ...args: unknown[]) => plain(raw.prepare(sql).get(...(flatten(args) as never[]))),
    withTransactionAsync: async (task: () => Promise<void>) => {
      // Transações aninhadas viram savepoints (o app chama transação dentro de transação em alguns fluxos)
      const name = `sp_${Math.random().toString(36).slice(2)}`;
      raw.exec(`SAVEPOINT ${name}`);
      try {
        await task();
        raw.exec(`RELEASE ${name}`);
      } catch (e) {
        raw.exec(`ROLLBACK TO ${name}`);
        raw.exec(`RELEASE ${name}`);
        throw e;
      }
    },
    withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) => {
      await db.withTransactionAsync(() => task(db));
    },
  };

  const typed = db as unknown as SQLiteDatabase;
  await migrateDbIfNeeded(typed);
  return typed;
}
