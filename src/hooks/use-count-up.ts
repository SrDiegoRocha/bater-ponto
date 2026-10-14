import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

// Número que "conta" até o valor novo (§7: count-up ao entrar e ao trocar de período).
// ~400ms com ease-out; respeita "Reduzir movimento".

const DURATION = 400;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function useCountUp(target: number): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const currentRef = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      currentRef.current = target;
      return;
    }
    const from = currentRef.current;
    if (from === target) return;
    const start = Date.now();
    let frame: number;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      const next = from + (target - from) * easeOut(p);
      currentRef.current = next;
      setValue(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  return reduceMotion ? target : value;
}
