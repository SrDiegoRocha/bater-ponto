import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useEffectEvent, useState } from 'react';

import { useDataStore } from '@/stores/data-store';

/**
 * Executa uma consulta e recarrega quando `deps` mudam ou quando qualquer escrita chama `bumpData()`.
 * Mantém o último resultado enquanto recarrega (sem "piscar" a tela).
 */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: readonly unknown[]) {
  const db = useSQLiteContext();
  const revision = useDataStore((s) => s.revision);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const runQuery = useEffectEvent(() => query(db));
  const key = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    runQuery()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [db, revision, key]);

  return { data, error, loading: data === undefined && !error };
}
