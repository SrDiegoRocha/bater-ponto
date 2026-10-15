import * as QuickActions from 'expo-quick-actions';

import type { DayState } from '@/domain/state-machine';

// Atalhos no ícone do app (segurar o ícone na tela inicial). O primeiro muda conforme o estado do dia.
// Sem módulo nativo (Expo Go) as chamadas viram no-op.

const primaryTitle: Record<DayState, string> = {
  off: 'Iniciar dia',
  working: 'Pausar',
  break: 'Voltar ao trabalho',
};

export function updateQuickActions(state: DayState): void {
  QuickActions.setItems([
    { id: 'punch', title: primaryTitle[state], icon: 'time', params: { href: '/?acao=bater' } },
    ...(state !== 'off' ? [{ id: 'end', title: 'Encerrar dia', icon: 'pause', params: { href: '/?acao=encerrar' } }] : []),
    { id: 'manual', title: 'Registrar jornada', icon: 'compose', params: { href: '/jornada/nova' } },
    { id: 'summary', title: 'Resumo do período', icon: 'home', params: { href: '/resumo' } },
  ]).catch(() => {});
}
