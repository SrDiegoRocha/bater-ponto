import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { listenReminderTaps, syncReminders } from '@/services/reminders';
import { useDataStore } from '@/stores/data-store';
import { useSettings, useSettingsStore } from '@/stores/settings-store';

/**
 * Mantém os lembretes em dia: refaz o plano quando algo é anotado, quando um ajuste muda e quando o
 * app volta para a frente (o tempo passou). Tocar num lembrete abre a tela do link dele.
 */
export function ReminderSync() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const revision = useDataStore((s) => s.revision);

  useEffect(() => {
    // Espera as escritas em sequência terminarem (ex.: anotar várias batidas) antes de refazer
    const timer = setTimeout(() => syncReminders(db, settings), 500);
    return () => clearTimeout(timer);
  }, [db, settings, revision]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders(db, useSettingsStore.getState().settings);
    });
    return () => sub.remove();
  }, [db]);

  // Na abertura a frio o navegador ainda está montando: navega no próximo ciclo
  useEffect(() => listenReminderTaps((href) => setTimeout(() => router.push(href as Href))), []);

  return null;
}
