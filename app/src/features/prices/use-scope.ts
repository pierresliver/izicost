// Scope selector state: Near me · My city · By city · Anywhere. Remembers "my city" and the Near-me radius.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { nearbyStores, type CityRow, type ScopeFilter } from './api';
import { captureLocation } from './location';

export type ScopeMode = 'near' | 'mycity' | 'bycity' | 'anywhere';
const CITY_KEY = 'izicost.prices.mycity';
const RADIUS_KEY = 'izicost.prices.radiusKm';
export const RADIUS_OPTIONS = [2, 5, 10, 25] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];
const DEFAULT_RADIUS: RadiusKm = 10;

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
  /** Last GPS fix used for "Near me" (screens reuse it for distances). */
  pos: { lat: number; lng: number } | null;
  radiusKm: RadiusKm;
  setRadiusKm: (km: RadiusKm) => void;
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
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusState] = useState<RadiusKm>(DEFAULT_RADIUS);
  const radiusRef = useRef<RadiusKm>(DEFAULT_RADIUS);

  useEffect(() => {
    AsyncStorage.multiGet([CITY_KEY, RADIUS_KEY]).then(([[, city], [, radius]]) => {
      if (city) { try { const c = JSON.parse(city) as CityRow; if (c?.city) { setMyCityState(c); setModeState('mycity'); } } catch { /* ignore */ } }
      const km = Number(radius);
      if (RADIUS_OPTIONS.includes(km as RadiusKm)) { radiusRef.current = km as RadiusKm; setRadiusState(km as RadiusKm); }
    }).catch(() => {});
  }, []);

  const setMyCity = useCallback((c: CityRow | null) => {
    setMyCityState(c);
    if (c) AsyncStorage.setItem(CITY_KEY, JSON.stringify(c)).catch(() => {});
    else AsyncStorage.removeItem(CITY_KEY).catch(() => {});
  }, []);

  /** Re-runs the store lookup around the last fix (or a fresh one) with the current radius. */
  const lookup = useCallback(async (p: { lat: number; lng: number }) => {
    try {
      const stores = await nearbyStores(p.lat, p.lng, radiusRef.current);
      setNearStoreIds(stores.map((s) => s.id));
      setNearStatus(stores.length ? 'ok' : 'empty');
    } catch {
      setNearStatus('empty'); setNearStoreIds([]);
    }
  }, []);

  const refreshNear = useCallback(async () => {
    setNearStatus('locating');
    const p = await captureLocation();
    if (!p) { setNearStatus('denied'); setNearStoreIds(null); setPos(null); return; }
    setPos(p);
    await lookup(p);
  }, [lookup]);

  const setRadiusKm = useCallback((km: RadiusKm) => {
    radiusRef.current = km; setRadiusState(km);
    AsyncStorage.setItem(RADIUS_KEY, String(km)).catch(() => {});
    if (pos) lookup(pos); // same fix, new circle: no new GPS request and no 'locating' flash (the list just updates)
  }, [pos, lookup]);

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

  return { mode, setMode, myCity, setMyCity, otherCity, setOtherCity, nearStatus, nearStoreIds, pos, radiusKm, setRadiusKm, filter, needsCity, refreshNear };
}
