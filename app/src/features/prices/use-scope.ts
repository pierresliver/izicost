// Scope selector state: Near me · My city · By city · Anywhere. Remembers "my city".
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { nearbyStores, type CityRow, type ScopeFilter } from './api';
import { captureLocation } from './location';

export type ScopeMode = 'near' | 'mycity' | 'bycity' | 'anywhere';
const CITY_KEY = 'izicost.prices.mycity';

export type ScopeState = {
  mode: ScopeMode;
  setMode: (m: ScopeMode) => void;
  myCity: CityRow | null;
  setMyCity: (c: CityRow | null) => void;
  otherCity: CityRow | null;
  setOtherCity: (c: CityRow | null) => void;
  /** 'idle' | 'locating' | 'ok' | 'denied' | 'empty' (GPS ok but no store within range) */
  nearStatus: 'idle' | 'locating' | 'ok' | 'denied' | 'empty';
  nearStoreIds: string[] | null;
  /** The filter to send to the backend, or null while the scope is not ready (e.g. city not chosen). */
  filter: ScopeFilter | null;
  /** Which picker the screen should open, if any, for the current mode. */
  needsCity: boolean;
  refreshNear: () => Promise<void>;
};

export function useScope(): ScopeState {
  const [mode, setModeState] = useState<ScopeMode>('anywhere');
  const [myCity, setMyCityState] = useState<CityRow | null>(null);
  const [otherCity, setOtherCity] = useState<CityRow | null>(null);
  const [nearStatus, setNearStatus] = useState<ScopeState['nearStatus']>('idle');
  const [nearStoreIds, setNearStoreIds] = useState<string[] | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CITY_KEY).then((v) => {
      if (!v) return;
      try { const c = JSON.parse(v) as CityRow; if (c?.city) { setMyCityState(c); setModeState('mycity'); } } catch { /* ignore */ }
    }).catch(() => {});
  }, []);

  const setMyCity = useCallback((c: CityRow | null) => {
    setMyCityState(c);
    if (c) AsyncStorage.setItem(CITY_KEY, JSON.stringify(c)).catch(() => {});
    else AsyncStorage.removeItem(CITY_KEY).catch(() => {});
  }, []);

  const refreshNear = useCallback(async () => {
    setNearStatus('locating');
    const pos = await captureLocation();
    if (!pos) { setNearStatus('denied'); setNearStoreIds(null); return; }
    try {
      const stores = await nearbyStores(pos.lat, pos.lng, 10);
      setNearStoreIds(stores.map((s) => s.id));
      setNearStatus(stores.length ? 'ok' : 'empty');
    } catch {
      setNearStatus('empty'); setNearStoreIds([]);
    }
  }, []);

  const setMode = useCallback((m: ScopeMode) => {
    setModeState(m);
    if (m === 'near' && nearStatus === 'idle') refreshNear();
  }, [nearStatus, refreshNear]);

  const filter = useMemo<ScopeFilter | null>(() => {
    switch (mode) {
      case 'anywhere': return {};
      case 'mycity': return myCity ? { city: myCity.city, country: myCity.country } : null;
      case 'bycity': return otherCity ? { city: otherCity.city, country: otherCity.country } : null;
      case 'near':
        if (nearStatus === 'ok' && nearStoreIds?.length) return { storeIds: nearStoreIds };
        if (nearStatus === 'denied' || nearStatus === 'empty') return myCity ? { city: myCity.city, country: myCity.country } : {};
        return null;
    }
  }, [mode, myCity, otherCity, nearStatus, nearStoreIds]);

  const needsCity = (mode === 'mycity' && !myCity) || (mode === 'bycity' && !otherCity);

  return { mode, setMode, myCity, setMyCity, otherCity, setOtherCity, nearStatus, nearStoreIds, filter, needsCity, refreshNear };
}
