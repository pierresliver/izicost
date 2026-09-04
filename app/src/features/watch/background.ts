// Price-drop alerts while the app is closed (stage B, no external push service needed): Android's
// WorkManager wakes the app every few hours, we ask the server for the watch list, and any new drop
// becomes a notification on the spot. Same rules as the in-app check (isNewDrop + markNotified), so
// nothing is announced twice. Registered when the user turns a bell on; unregistered when alerts go off.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { supabase } from '@/lib/supabase';

import { isNewDrop, markNotified, watchlist } from './api';
import { getDropPref, notifyDrops } from './notify';

export const PRICE_CHECK_TASK = 'izicost.priceCheck';
const EVERY_MINUTES = 6 * 60; // Android treats this as a minimum; the OS decides the exact moment

// Must run at module load (the task can fire before any screen exists).
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    if ((await getDropPref()) !== 'on') return BackgroundTask.BackgroundTaskResult.Success;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return BackgroundTask.BackgroundTaskResult.Success; // never start a guest session from the background
    const rows = await watchlist();
    const fresh = rows.filter(isNewDrop);
    if (fresh.length) {
      await notifyDrops(fresh);
      await Promise.all(fresh.map((r) => markNotified(r.watch_id, r.best_price!).catch(() => {})));
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerPriceCheck(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK))) {
      await BackgroundTask.registerTaskAsync(PRICE_CHECK_TASK, { minimumInterval: EVERY_MINUTES });
    }
    return true;
  } catch { return false; }
}

export async function unregisterPriceCheck(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK)) await BackgroundTask.unregisterTaskAsync(PRICE_CHECK_TASK);
  } catch { /* fine */ }
}
