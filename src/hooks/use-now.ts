import { useEffect, useState } from 'react';

/** Hora atual, atualizada no início de cada intervalo (padrão: a cada minuto cheio) */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = intervalMs - (Date.now() % intervalMs) + 5;
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [intervalMs]);
  return now;
}
