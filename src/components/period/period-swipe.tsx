import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useUiStore } from '@/stores/ui-store';

// Deslizar para os lados troca de período (esquerda = próximo, direita = anterior).
// Só ativa com movimento claramente horizontal, para não brigar com a rolagem vertical.

export function PeriodSwipe({ children }: { children: ReactNode }) {
  const gesture = Gesture.Pan()
    .activeOffsetX([-40, 40])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd((e) => {
      const { periodOffset, setPeriodOffset } = useUiStore.getState();
      if (Math.abs(e.translationX) < 60) return;
      const delta = e.translationX < 0 ? 1 : -1;
      if (periodOffset + delta > 0) return; // não existe período futuro
      Haptics.selectionAsync().catch(() => {});
      setPeriodOffset(periodOffset + delta);
    });

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
