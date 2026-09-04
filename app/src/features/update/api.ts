// "Update available": the app reads a tiny public manifest (latest.json in the releases bucket) and compares
// the version code with its own. The download is the APK in the same public bucket. Same idea as IziCamera.
import Constants from 'expo-constants';
import { Linking } from 'react-native';

const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const RELEASES_URL = base ? `${base}/storage/v1/object/public/releases` : '';
export const LATEST_APK_URL = RELEASES_URL ? `${RELEASES_URL}/izicost-latest.apk` : '';

export type Release = { version: string; versionCode: number; url: string; size_mb?: number; notes?: string; published_at?: string };

export function installedVersion(): { version: string; versionCode: number } {
  const cfg = Constants.expoConfig;
  return { version: cfg?.version ?? '0.0.0', versionCode: Number(cfg?.android?.versionCode ?? 0) };
}

/** null = no manifest published yet (or offline). */
export async function fetchLatest(): Promise<Release | null> {
  if (!RELEASES_URL) return null;
  try {
    const r = await fetch(`${RELEASES_URL}/latest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as Partial<Release>;
    if (!j || typeof j.versionCode !== 'number' || typeof j.version !== 'string' || typeof j.url !== 'string') return null;
    if (!j.url.startsWith(`${RELEASES_URL}/`) || j.url.includes('..')) return null; // only ever open a file inside our own bucket
    return j as Release;
  } catch { return null; }
}

export function isNewer(latest: Release | null): boolean {
  return !!latest && latest.versionCode > installedVersion().versionCode;
}

export async function openDownload(latest: Release): Promise<void> {
  await Linking.openURL(latest.url);
}
