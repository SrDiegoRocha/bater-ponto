import { create } from 'zustand';

// Estado efêmero de interface: período selecionado (compartilhado entre Histórico, Resumo e Salário) e toasts.

export type ToastAction = { label: string; onPress: () => void };
export type Toast = { id: number; message: string; actions: ToastAction[]; duration: number };

type UiState = {
  /** Deslocamento em relação ao período atual (0 = atual, −1 = anterior…) */
  periodOffset: number;
  setPeriodOffset: (offset: number) => void;
  toast: Toast | null;
  showToast: (message: string, options?: { actions?: ToastAction[]; duration?: number }) => void;
  hideToast: (id?: number) => void;
};

let nextToastId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  periodOffset: 0,
  setPeriodOffset: (periodOffset) => set({ periodOffset }),
  toast: null,
  showToast: (message, { actions = [], duration = 5000 } = {}) =>
    set({ toast: { id: nextToastId++, message, actions, duration } }),
  hideToast: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
}));

export const showToast = (...args: Parameters<UiState['showToast']>) => useUiStore.getState().showToast(...args);
