// Weekly recap: one local notification every Sunday at 18:00 with the last 7 days in numbers.
// The text is computed when scheduling, so Home re-schedules on every focus (cheap, idempotent).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

const PREF_KEY = 'izicost.weeklyRecap';       // 'on' | 'off' | (unset = never asked)
const ID_KEY = 'izicost.weeklyRecap.id';
const CHANNEL = 'weekly-recap';

export type RecapPref = 'on' | 'off' | null;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
} catch { /* not available (e.g. web) */ }

export async function getRecapPref(): Promise<RecapPref> {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch { return null; }
}

export async function setRecapPref(v: 'on' | 'off'): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, v).catch(() => {});
  if (v === 'off') await cancelWeeklyRecap();
}

/** Ask the OS for permission. Returns true when granted; stores the preference either way. */
export async function enableWeeklyRecap(): Promise<boolean> {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    await AsyncStorage.setItem(PREF_KEY, status === 'granted' ? 'on' : 'off');
    return status === 'granted';
  } catch {
    await AsyncStorage.setItem(PREF_KEY, 'off').catch(() => {});
    return false;
  }
}

export async function cancelWeeklyRecap(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(ID_KEY);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(ID_KEY);
  } catch { /* ignore */ }
}

/**
 * (Re)schedule the Sunday 18:00 notification with fresh numbers. No-op unless the user opted in
 * and permission is granted. Safe to call often.
 */
export async function rescheduleWeeklyRecap(weekTotal: number, weekReceipts: number, currency: string): Promise<void> {
  try {
    if ((await getRecapPref()) !== 'on') return;
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: t('Weekly recap'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await cancelWeeklyRecap();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t('Your week in numbers'),
        body: t('Your week: %amount% across %n% receipts', { amount: formatMoney(weekTotal, currency), n: weekReceipts }),
        data: { route: '/recap' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 18,
        minute: 0,
        channelId: CHANNEL,
      },
    });
    await AsyncStorage.setItem(ID_KEY, id);
  } catch (e) {
    console.warn('weekly recap', e);
  }
}
