import * as QuickActions from 'expo-quick-actions';

import type { DayState } from '@/domain/state-machine';

// Atalhos no ícone do app (segurar o ícone na tela inicial). O primeiro muda conforme o estado do dia.
// Sem módulo nativo (Expo Go) as chamadas viram no-op.

const primaryTitle: Record<DayState, string> = {
  off: 'Anotar entrada',
  working: 'Anotar saída',
  break: 'Anotar volta',
};

export function updateQuickActions(state: DayState): void {
  QuickActions.setItems([
    { id: 'punch', title: primaryTitle[state], icon: 'time', params: { href: '/bater' } },
    { id: 'manual', title: 'Anotar o dia inteiro', icon: 'compose', params: { href: '/jornada/nova' } },
    { id: 'summary', title: 'Resumo do período', icon: 'home', params: { href: '/resumo' } },
  ]).catch(() => {});
}
