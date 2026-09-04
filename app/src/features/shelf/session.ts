// One shelf-scan walk, kept in memory while the person moves between the setup, capture, photo
// review and item review screens (same idea as lib/pending.ts: never through the URL).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import type { StoreInfo } from '@/features/prices/api';

import type { ShelfItem, ShelfPhotoNote } from './api';

export type Shot = { uri: string; score: number; blurry: boolean; keep: boolean; takenAt: number };

export type ShelfSession = {
  store: StoreInfo;
  currency: 'MZN' | 'ZAR';
  intervalSec: number;
  shots: Shot[];
  /** Filled after the server has read the photos. */
  items: ShelfItem[];
  photoNotes: ShelfPhotoNote[];
  photosRead: number;
};

let current: ShelfSession | null = null;

export function startSession(store: StoreInfo, currency: 'MZN' | 'ZAR', intervalSec: number): ShelfSession {
  current = { store, currency, intervalSec, shots: [], items: [], photoNotes: [], photosRead: 0 };
  return current;
}
export function getSession(): ShelfSession | null { return current; }
export function updateSession(patch: Partial<ShelfSession>): void { if (current) current = { ...current, ...patch }; }
export function clearSession(): void { current = null; }

/** Delete local photo files (best effort). */
export function disposeShots(uris: string[]): void {
  for (const u of uris) FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {});
}
/** Forget the walk AND delete its photos from this phone. */
export function disposeSession(): void {
  if (current) disposeShots(current.shots.map((s) => s.uri));
  current = null;
}

export const INTERVALS = [3, 5, 8, 12] as const;
const INTERVAL_KEY = 'izicost.shelf.intervalSec';
export async function loadInterval(): Promise<number> {
  const v = Number(await AsyncStorage.getItem(INTERVAL_KEY).catch(() => null));
  return INTERVALS.includes(v as (typeof INTERVALS)[number]) ? v : 5;
}
export async function saveInterval(sec: number): Promise<void> { await AsyncStorage.setItem(INTERVAL_KEY, String(sec)).catch(() => {}); }

/** Currency follows the shop's country; Mozambique when unknown. */
export function currencyFor(store: StoreInfo | null): 'MZN' | 'ZAR' { return store?.country === 'ZA' ? 'ZAR' : 'MZN'; }
