// Checks the user's price alerts when a screen gains focus — at most once every 10 minutes —
// and keeps the hits in memory until the user dismisses them. Each hit is recorded server-side
// the moment it is fetched, so the same drop is never announced twice.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { checkPriceAlerts, recordHits, type AlertHit } from './api';

const CHECKED_KEY = 'izicost.alerts.checked_at';
const THROTTLE_MS = 10 * 60 * 1000;

export function useAlertHits(): { hits: AlertHit[]; dismiss: (alertId: string) => void; refresh: () => Promise<number> } {
  const [hits, setHits] = useState<AlertHit[]>([]);

  /** Returns how many new hits were found. */
  const run = useCallback(async (force: boolean): Promise<number> => {
    if (!force) {
      const last = Number((await AsyncStorage.getItem(CHECKED_KEY).catch(() => null)) ?? 0);
      if (Date.now() - last < THROTTLE_MS) return 0;
    }
    await AsyncStorage.setItem(CHECKED_KEY, String(Date.now())).catch(() => {});
    const rows = await checkPriceAlerts();
    if (!rows.length) return 0;
    setHits((prev) => {
      const seen = new Set(prev.map((h) => h.alert_id));
      return [...prev, ...rows.filter((r) => !seen.has(r.alert_id))];
    });
    await recordHits(rows.map((r) => r.alert_id)).catch(() => {});
    return rows.length;
  }, []);

  useFocusEffect(useCallback(() => { run(false).catch(() => {}); }, [run]));

  const dismiss = useCallback((alertId: string) => setHits((h) => h.filter((x) => x.alert_id !== alertId)), []);
  const refresh = useCallback(() => run(true), [run]);
  return { hits, dismiss, refresh };
}
