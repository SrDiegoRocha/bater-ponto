import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { buildBackup, parseBackup, type BackupFile, type BackupPreview } from '@/domain/backup-schema';
import { toDateKey } from '@/domain/time';
import { exportData, importData, wipeAllData } from '@/db/backup-repo';
import { saveSettings } from '@/db/settings-repo';
import { bumpData } from '@/stores/data-store';
import { useSettingsStore } from '@/stores/settings-store';

// Backup e restauração por arquivo (PLANEJAMENTO.md §3.9).

const appVersion = () => Constants.expoConfig?.version ?? '1.0.0';

async function writeBackupFile(db: SQLiteDatabase, directory: Directory | typeof Paths.cache, name: string): Promise<File> {
  const backup = buildBackup(await exportData(db), appVersion());
  const file = new File(directory, name);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup));
  return file;
}

/** B1: gera o arquivo e abre o compartilhamento do Android */
export async function shareBackup(db: SQLiteDatabase): Promise<void> {
  const file = await writeBackupFile(db, Paths.cache, `bater-ponto-backup_${toDateKey(Date.now())}.json`);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup do Bater Ponto',
  });
  const lastBackupAt = Date.now();
  await saveSettings(db, { lastBackupAt });
  useSettingsStore.setState((s) => ({ settings: { ...s.settings, lastBackupAt } }));
}

export type PickedBackup = { file: BackupFile; preview: BackupPreview };

/** B2: escolhe e valida o arquivo. Retorna null se o usuário cancelou. */
export async function pickBackup(): Promise<PickedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const text = await new File(result.assets[0].uri).text();
  const parsed = parseBackup(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return { file: parsed.file, preview: parsed.preview };
}

/** B3: guarda uma cópia do estado atual no armazenamento do app antes de substituir */
async function safetyBackup(db: SQLiteDatabase): Promise<void> {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create();
  await writeBackupFile(db, dir, `antes-de-restaurar_${Date.now()}.json`);
}

export async function restoreBackup(db: SQLiteDatabase, picked: PickedBackup): Promise<void> {
  await safetyBackup(db);
  await importData(db, picked.file.data);
  await useSettingsStore.getState().hydrate(db);
  bumpData();
}

export async function eraseAllData(db: SQLiteDatabase): Promise<void> {
  await safetyBackup(db);
  await wipeAllData(db);
  await useSettingsStore.getState().hydrate(db);
  bumpData();
}

// ---- Backup automático silencioso -------------------------------------------------------------

const AUTO_PREFIX = 'auto_';
const AUTO_KEEP = 4;
const AUTO_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

function backupsDir(): Directory {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create();
  return dir;
}

export type StoredBackup = { name: string; uri: string; kind: 'auto' | 'safety'; createdAt: number };

/** Backups guardados no próprio app (automáticos e os feitos antes de restaurar/apagar), mais novos primeiro */
export function listStoredBackups(): StoredBackup[] {
  return backupsDir()
    .list()
    .filter((f): f is File => f instanceof File && f.name.endsWith('.json'))
    .map((f) => {
      const stamp = Number(f.name.match(/(\d{10,})/)?.[1] ?? 0);
      return {
        name: f.name,
        uri: f.uri,
        kind: f.name.startsWith(AUTO_PREFIX) ? ('auto' as const) : ('safety' as const),
        createdAt: stamp || (f.modificationTime ?? 0),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Roda na abertura do app: uma cópia por semana, guarda só as 4 mais recentes */
export async function runAutoBackupIfDue(db: SQLiteDatabase): Promise<void> {
  const { settings } = useSettingsStore.getState();
  if (!settings.autoBackup) return;
  const now = Date.now();
  if (settings.lastAutoBackupAt !== null && now - settings.lastAutoBackupAt < AUTO_EVERY_MS) return;

  await writeBackupFile(db, backupsDir(), `${AUTO_PREFIX}${now}.json`);
  for (const old of listStoredBackups().filter((b) => b.kind === 'auto').slice(AUTO_KEEP)) {
    new File(old.uri).delete();
  }
  await saveSettings(db, { lastAutoBackupAt: now });
  useSettingsStore.setState((s) => ({ settings: { ...s.settings, lastAutoBackupAt: now } }));
}

export async function readStoredBackup(uri: string): Promise<PickedBackup> {
  const parsed = parseBackup(await new File(uri).text());
  if (!parsed.ok) throw new Error(parsed.error);
  return { file: parsed.file, preview: parsed.preview };
}
