import * as LocalAuthentication from 'expo-local-authentication';

import { useLockStore } from '@/stores/lock-store';

// Biometria / bloqueio de tela do Android (PLANEJAMENTO.md §3.10).

export type LockAvailability = { available: true } | { available: false; reason: string };

/** L2: precisa de biometria cadastrada ou, no mínimo, PIN/padrão/senha do aparelho */
export async function getLockAvailability(): Promise<LockAvailability> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return { available: false, reason: 'Configure um bloqueio de tela (PIN, padrão, senha ou digital) no Android.' };
  }
  return { available: true };
}

/** Pede autenticação. Aceita PIN/padrão como alternativa à biometria (L6). */
export async function authenticate(promptMessage = 'Desbloquear o Bater Ponto'): Promise<boolean> {
  const lock = useLockStore.getState();
  lock.setAuthenticating(true);
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
      requireConfirmation: false,
    });
    return result.success;
  } finally {
    // O diálogo do sistema pode disparar mudanças de AppState; ignora-as por um instante
    setTimeout(() => useLockStore.getState().setAuthenticating(false), 500);
  }
}
