// Offline queue: receipts photographed without internet wait here (AsyncStorage + copies of the
// photos in the app's document folder, so a cache purge cannot lose them).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export const QUEUE_KEY = 'izicost.scanQueue';

export type QueuedScan = { id: string; localUris: string[]; createdAt: number };

const listeners = new Set<(q: QueuedScan[]) => void>();
let cache: QueuedScan[] | null = null;

function queueDir(): string {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  return `${base}scanQueue/`;
}

export async function loadQueue(): Promise<QueuedScan[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedScan[]) : [];
    cache = Array.isArray(parsed) ? parsed.filter((q) => q && Array.isArray(q.localUris) && q.localUris.length > 0) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(q: QueuedScan[]): Promise<void> {
  cache = q;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  for (const l of listeners) l(q);
}

/** Subscribe to queue changes; returns an unsubscribe function. */
export function subscribeQueue(fn: (q: QueuedScan[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Copy the photos somewhere durable and add the scan to the queue. Returns the new entry. */
export async function enqueueScan(localUris: string[]): Promise<QueuedScan> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = queueDir();
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch { /* exists */ }
  const stored: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const dest = `${dir}${id}_${i}.jpg`;
    try {
      await FileSystem.copyAsync({ from: localUris[i], to: dest });
      stored.push(dest);
    } catch {
      stored.push(localUris[i]); // fall back to the original location
    }
  }
  const entry: QueuedScan = { id, localUris: stored, createdAt: Date.now() };
  const q = await loadQueue();
  await persist([...q, entry]);
  return entry;
}

/** Remove an entry (after a successful read, or when the user gives up on it). */
export async function dequeueScan(id: string, deleteFiles = true): Promise<void> {
  const q = await loadQueue();
  const entry = q.find((e) => e.id === id);
  await persist(q.filter((e) => e.id !== id));
  if (entry && deleteFiles) {
    for (const uri of entry.localUris) {
      if (uri.startsWith(queueDir())) {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* ignore */ }
      }
    }
  }
}
