import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '@/db/settings-repo';

// O SQLite é a fonte da verdade; este store só espelha as configurações em memória para a UI reagir.

type SettingsState = {
  settings: Settings;
  ready: boolean;
  hydrate: (db: SQLiteDatabase) => Promise<void>;
  update: (db: SQLiteDatabase, patch: Partial<Settings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  ready: false,
  hydrate: async (db) => {
    set({ settings: await loadSettings(db), ready: true });
  },
  update: async (db, patch) => {
    const previous = get().settings;
    set({ settings: { ...previous, ...patch } }); // otimista
    try {
      await saveSettings(db, patch);
    } catch (error) {
      set({ settings: previous });
      throw error;
    }
  },
}));

export const useSettings = () => useSettingsStore((s) => s.settings);
