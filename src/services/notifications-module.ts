import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';

// expo-notifications carregado sob demanda. O import do pacote já exige módulos nativos (ex.: o de
// tópicos de push) que podem faltar num Expo Go mais antigo que a biblioteca; com import estático, isso
// derrubava o app inteiro na abertura. Lembrete é um extra: sem os módulos, o app segue sem ele.

export type Notifications = typeof NotificationsModule;

/** Módulos nativos que o pacote exige ao ser importado no Android */
const REQUIRED_NATIVE_MODULES = [
  'ExpoNotificationScheduler',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationChannelManager',
  'ExpoNotificationChannelGroupManager',
  'ExpoNotificationCategoriesModule',
  'ExpoNotificationPresenter',
  'ExpoNotificationsEmitter',
  'ExpoNotificationsHandlerModule',
  'ExpoBackgroundNotificationTasksModule',
  'ExpoBadgeModule',
  'ExpoPushTokenManager',
  'ExpoTopicSubscriptionModule',
  'NotificationsServerRegistrationModule',
];

let cached: Notifications | null | undefined;

/** O módulo de notificações, ou null se este app não tiver o código nativo dele */
export function getNotifications(): Notifications | null {
  if (cached !== undefined) return cached;
  // Confere antes de importar: um import que falha ainda aparece como erro no Metro, mesmo tratado
  if (REQUIRED_NATIVE_MODULES.some((name) => !requireOptionalNativeModule(name))) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as Notifications;
  } catch {
    cached = null;
  }
  return cached;
}
