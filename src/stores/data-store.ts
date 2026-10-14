import { create } from 'zustand';

// Contador de revisão: toda escrita no banco chama `bump()`, e as consultas da UI recarregam.
// Simples e previsível para um app local com poucas tabelas.

type DataState = { revision: number; bump: () => void };

export const useDataStore = create<DataState>((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));

export const bumpData = () => useDataStore.getState().bump();
