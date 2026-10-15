import type { NotificationResponse } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { holidaysInRange } from '@/domain/holidays';
import { END_OF_DAY_HORIZON, planReminders, REMINDER_ID_PREFIX, weekdaysFromDates } from '@/domain/reminders';
import { addDaysToKey, MINUTE, toDateKey } from '@/domain/time';
import { summarizeWorkday } from '@/domain/workday';
import { listDayOffs } from '@/db/day-off-repo';
import { listHolidayOverrides } from '@/db/holiday-repo';
import type { Settings } from '@/db/settings-repo';
import { getOpenWorkday, listWorkdays } from '@/db/workday-repo';

import { getNotifications, type Notifications } from './notifications-module';

// Lembretes locais (do próprio celular, sem servidor): agenda o plano de domain/reminders.ts.
// Notificações locais funcionam no Expo Go; só as push remotas é que não.

const CHANNEL_ID = 'lembretes';
/** Semanas usadas para aprender em quais dias da semana a pessoa trabalha */
const LEARN_DAYS = 28;

let handlerSet = false;

/** O módulo pronto para uso (handler de primeiro plano configurado), ou null se indisponível */
function notifications(): Notifications | null {
  const N = getNotifications();
  if (N && !handlerSet) {
    handlerSet = true;
    // Mostra o aviso mesmo com o app aberto
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return N;
}

/** Este app consegue mostrar lembretes? (false num Expo Go sem o módulo nativo) */
export function remindersAvailable(): boolean {
  return notifications() !== null;
}

async function ensureChannel(N: Notifications) {
  // No Android 13+ o pedido de permissão só aparece depois que existe um canal
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes de ponto',
    importance: N.AndroidImportance.HIGH,
  });
}

/** Pede permissão de notificação. true = pode avisar */
export async function requestReminderPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  await ensureChannel(N);
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await N.requestPermissionsAsync()).granted;
}

/** Ao tocar num lembrete: chama `onOpen` com o link dele (também quando o toque abriu o app). */
export function listenReminderTaps(onOpen: (href: string) => void): () => void {
  const N = notifications();
  if (!N) return () => {};
  const handle = (response: NotificationResponse) => {
    if (response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    const href = response.notification.request.content.data?.href;
    if (typeof href === 'string') onOpen(href);
  };
  N.getLastNotificationResponseAsync()
    .then((last) => {
      if (!last) return;
      N.clearLastNotificationResponseAsync().catch(() => {});
      handle(last);
    })
    .catch(() => {});
  const sub = N.addNotificationResponseReceivedListener((response) => {
    N.clearLastNotificationResponseAsync().catch(() => {});
    handle(response);
  });
  return () => sub.remove();
}

let queue: Promise<void> = Promise.resolve();

/** Refaz os lembretes agendados a partir dos dados atuais. Chamadas em sequência, nunca em paralelo. */
export function syncReminders(db: SQLiteDatabase, settings: Settings): Promise<void> {
  const N = notifications();
  if (!N) return Promise.resolve();
  queue = queue.then(() => doSync(N, db, settings)).catch(() => {});
  return queue;
}

async function doSync(N: Notifications, db: SQLiteDatabase, settings: Settings) {
  const scheduled = await N.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(REMINDER_ID_PREFIX)) await N.cancelScheduledNotificationAsync(n.identifier);
  }
  if (!settings.reminders.enabled) return;
  if (!(await N.getPermissionsAsync()).granted) return;
  await ensureChannel(N);

  const now = Date.now();
  const today = toDateKey(now);
  const horizonEnd = addDaysToKey(today, END_OF_DAY_HORIZON - 1);
  const open = await getOpenWorkday(db);
  const recent = await listWorkdays(db, addDaysToKey(today, -LEARN_DAYS), horizonEnd);
  const dayOffs = await listDayOffs(db, today, horizonEnd);
  const holidays = holidaysInRange(today, horizonEnd, await listHolidayOverrides(db), {
    includeOptional: settings.optionalHolidays,
  });

  const plan = planReminders({
    now,
    settings: settings.reminders,
    dailyLimitMs: settings.workRules.dailyLimitMinutes * MINUTE,
    openPunches: open ? open.punches.map((p) => ({ kind: p.kind, at: p.at })) : null,
    openWorkedMs: open ? summarizeWorkday(open.punches, now).workedMs : 0,
    recordedDates: new Set(recent.map((w) => w.refDate)),
    skipDates: new Set([...dayOffs.map((d) => d.date), ...holidays.keys()]),
    workWeekdays: weekdaysFromDates(recent.filter((w) => w.refDate < today).map((w) => w.refDate)),
  });

  for (const r of plan) {
    await N.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { href: r.href } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID },
    });
  }
}
