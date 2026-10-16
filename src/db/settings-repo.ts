import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_REMINDERS, type ReminderSettings } from '@/domain/reminders';
import { CLT_RULES, type WorkRules } from '@/domain/work-rules';

// Configurações em chave/valor (JSON). Os padrões vivem aqui, então uma chave ausente no banco
// sempre tem um valor válido.

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  onboardingDone: boolean;
  periodStartDay: number;
  hourlyRate: number;
  /** Regras da jornada (limites da CLT ou do contrato); substituem a antiga meta diária */
  workRules: WorkRules;
  /** Intervalo reduzido/fracionado por convenção (CLT art. 71 §5º: motoristas, cobradores…) */
  splitBreak: boolean;
  minRestMinutes: number;
  maxWorkdayMinutes: number;
  salaryMode: 'simple' | 'clt';
  overtimePct: number;
  holidayOvertimePct: number;
  nightPct: number;
  nightReduced: boolean;
  dsrOnExtras: boolean;
  /** Domingo trabalhado conta como hora extra 100% */
  sundayDouble: boolean;
  /** Dependentes para o IRRF */
  dependents: number;
  optionalHolidays: boolean;
  theme: ThemePreference;
  userName: string;
  lastBackupAt: number | null;
  /** Trava por biometria — fica FORA do backup (L7) */
  biometricLock: boolean;
  lockAfterSec: number;
  /** Backup automático semanal guardado no próprio app */
  autoBackup: boolean;
  lastAutoBackupAt: number | null;
  /** Lembretes por notificação (do aparelho: dependem da permissão dele) */
  reminders: ReminderSettings;
};

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  periodStartDay: 21,
  hourlyRate: 0,
  workRules: CLT_RULES,
  splitBreak: false,
  minRestMinutes: 660,
  maxWorkdayMinutes: 1440,
  salaryMode: 'simple',
  overtimePct: 50,
  holidayOvertimePct: 100,
  nightPct: 20,
  nightReduced: true,
  dsrOnExtras: true,
  sundayDouble: true,
  dependents: 0,
  optionalHolidays: false,
  theme: 'system',
  userName: '',
  lastBackupAt: null,
  biometricLock: false,
  lockAfterSec: 60,
  autoBackup: true,
  lastAutoBackupAt: null,
  reminders: DEFAULT_REMINDERS,
};

/** Chaves que pertencem ao aparelho, não aos dados (não entram no backup) */
export const DEVICE_ONLY_SETTINGS: readonly (keyof Settings)[] = ['biometricLock', 'lockAfterSec', 'autoBackup', 'lastAutoBackupAt', 'reminders'];

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM setting');
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    try {
      const parsed: unknown = JSON.parse(value);
      const fallback = (DEFAULT_SETTINGS as Record<string, unknown>)[key];
      // Objetos (lembretes, regras) mesclam com o padrão: campo novo de uma versão nova já nasce válido
      (settings as Record<string, unknown>)[key] =
        isPlainObject(fallback) && isPlainObject(parsed) ? { ...fallback, ...parsed } : parsed;
    } catch {
      // valor corrompido: mantém o padrão
    }
  }
  return settings;
}

export async function saveSettings(db: SQLiteDatabase, patch: Partial<Settings>): Promise<void> {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
  if (entries.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await db.runAsync(
        'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        JSON.stringify(value),
      );
    }
  });
}
