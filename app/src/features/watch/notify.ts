// Price-drop notifications. Stage A: fired locally when the app checks the list (Home focus) — there is
// no server push yet, so nothing arrives while the app is closed. Permission is asked the first time the
// user turns a bell on; the preference is remembered.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import type { WatchRow } from './api';

const PREF_KEY = 'izicost.priceDrops';   // 'on' | 'off' | unset
const CHANNEL = 'price-drops';

export type DropPref = 'on' | 'off' | null;

export async function getDropPref(): Promise<DropPref> {
  try { const v = await AsyncStorage.getItem(PREF_KEY); return v === 'on' || v === 'off' ? v : null; } catch { return null; }
}

/** Ask the OS (once) and remember. Returns true when notifications may be shown. */
export async function enableDrops(): Promise<boolean> {
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

export async function disableDrops(): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, 'off').catch(() => {});
}

/** Show one notification per dropped item, right now. No-op unless the user opted in and the OS allows it. */
export async function notifyDrops(rows: WatchRow[]): Promise<void> {
  if (!rows.length) return;
  try {
    if ((await getDropPref()) !== 'on') return;
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: t('Price drops'), importance: Notifications.AndroidImportance.DEFAULT });
    }
    for (const r of rows.slice(0, 5)) {
      const where = [r.best_store, r.best_city].filter(Boolean).join(' · ');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('📉 %name% is cheaper', { name: r.display_name }),
          body: r.my_last_price !== null
            ? t('%price% at %where% — you paid %was% last time.', { price: formatMoney(r.best_price, r.currency), where, was: formatMoney(r.my_last_price, r.currency) })
            : t('%price% at %where% — below the usual price.', { price: formatMoney(r.best_price, r.currency), where }),
          data: { product_key: r.product_key },
        },
        trigger: Platform.OS === 'android' ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: CHANNEL } : null,
      });
    }
  } catch (e) {
    console.warn('price drop notification', e);
  }
}
