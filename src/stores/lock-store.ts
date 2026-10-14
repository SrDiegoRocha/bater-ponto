import { create } from 'zustand';

// Estado da trava por biometria. Nunca é persistido: ao abrir o app a trava começa fechada (L3).

type LockState = {
  locked: boolean;
  /** Enquanto o diálogo de autenticação está aberto, mudanças de AppState não travam o app */
  authenticating: boolean;
  backgroundAt: number | null;
  setLocked: (locked: boolean) => void;
  setAuthenticating: (value: boolean) => void;
  setBackgroundAt: (at: number | null) => void;
};

export const useLockStore = create<LockState>((set) => ({
  locked: true,
  authenticating: false,
  backgroundAt: null,
  setLocked: (locked) => set({ locked }),
  setAuthenticating: (authenticating) => set({ authenticating }),
  setBackgroundAt: (backgroundAt) => set({ backgroundAt }),
}));
