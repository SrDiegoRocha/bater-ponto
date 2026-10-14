import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { formatShortDate } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';

import { authenticate } from './auth-service';
import { eraseAllData, pickBackup, restoreBackup, shareBackup } from './backup-service';

/** L8: ações sensíveis pedem autenticação de novo quando a trava está ligada */
async function reauthenticate(message: string): Promise<boolean> {
  if (!useSettingsStore.getState().settings.biometricLock) return true;
  return authenticate(message);
}

// Fluxos com confirmação (B2/B3) reaproveitados em Ajustes → Dados e no onboarding.

const confirm = (title: string, message: string, action: string, destructive = true) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );

export async function backupFlow(db: SQLiteDatabase): Promise<void> {
  try {
    await shareBackup(db);
  } catch (e) {
    Alert.alert('Não foi possível gerar o backup', (e as Error).message);
  }
}

/** Retorna true se restaurou */
export async function restoreFlow(db: SQLiteDatabase): Promise<boolean> {
  try {
    const picked = await pickBackup();
    if (!picked) return false;
    const { preview } = picked;
    const range = preview.firstDate && preview.lastDate
      ? `, de ${formatShortDate(preview.firstDate)} a ${formatShortDate(preview.lastDate)}`
      : '';
    const ok = await confirm(
      'Restaurar este backup?',
      `${preview.workdays} jornadas, ${preview.dayOffs} folgas${range}.\n\nTodos os dados atuais serão substituídos. Uma cópia deles fica guardada no app antes.`,
      'Continuar',
    );
    if (!ok) return false;
    const sure = await confirm('Tem certeza?', 'Esta ação substitui tudo o que está no app agora.', 'Restaurar');
    if (!sure) return false;
    if (!(await reauthenticate('Confirme para restaurar o backup'))) return false;
    await restoreBackup(db, picked);
    showToast('Backup restaurado');
    return true;
  } catch (e) {
    Alert.alert('Não foi possível restaurar', (e as Error).message);
    return false;
  }
}

export async function eraseFlow(db: SQLiteDatabase): Promise<boolean> {
  const wantsBackup = await new Promise<'backup' | 'erase' | 'cancel'>((resolve) =>
    Alert.alert('Apagar todos os dados?', 'Jornadas, folgas e configurações serão apagadas. Quer fazer um backup antes?', [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
      { text: 'Fazer backup', onPress: () => resolve('backup') },
      { text: 'Apagar', style: 'destructive', onPress: () => resolve('erase') },
    ], { cancelable: true, onDismiss: () => resolve('cancel') }),
  );
  if (wantsBackup === 'cancel') return false;
  if (wantsBackup === 'backup') {
    await backupFlow(db);
    return false;
  }
  const sure = await confirm('Tem certeza?', 'Não dá para desfazer.', 'Apagar tudo');
  if (!sure) return false;
  if (!(await reauthenticate('Confirme para apagar todos os dados'))) return false;
  await eraseAllData(db);
  return true;
}
