// Multi-photo upload + extraction for the scanning flow. Wraps lib/receipts.ts (not ours to edit).
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';

import { ensureSession, supabase } from '@/lib/supabase';
import type { Extraction } from '@/lib/types';

export const MAX_PHOTOS = 4;
/** Separator used inside receipts.image_path when one receipt has several photos. */
export const PATH_SEPARATOR = '|';

/** The server said the user hit the daily cap (HTTP 429). */
export class ScanLimitError extends Error {
  constructor(message = 'daily scan limit reached') { super(message); this.name = 'ScanLimitError'; }
}
/** The phone has no usable internet connection. */
export class OfflineError extends Error {
  constructor(message = 'offline') { super(message); this.name = 'OfflineError'; }
}

/**
 * receipts.image_path holds one storage path, or several joined by "|" for long receipts.
 * The detail screen (app/src/app/receipt/[id].tsx) must call this before signing URLs.
 */
export function splitImagePaths(path: string | null | undefined): string[] {
  if (!path) return [];
  return path.split(PATH_SEPARATOR).map((p) => p.trim()).filter(Boolean);
}
export function joinImagePaths(paths: string[]): string {
  return paths.join(PATH_SEPARATOR);
}

/** True when the phone believes it can reach the internet. Errs on the side of "online". */
export async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    if (s.isConnected === false) return false;
    if (s.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}

/** Heuristic: does this error look like a dropped connection rather than a server answer? */
export function looksLikeNetworkError(e: unknown): boolean {
  if (e instanceof OfflineError) return true;
  const err = e as { name?: string; message?: string } | null;
  if (!err) return false;
  if (err.name === 'FunctionsFetchError' || err.name === 'StorageUnknownError') return true;
  const m = String(err.message ?? '').toLowerCase();
  return /network request failed|failed to fetch|network error|internet|offline|econnrefused|enotfound|etimedout|timed out|socket|unable to resolve host/.test(m);
}

/** Upload every prepared photo of one receipt under `${uid}/${Date.now()}_${i}.jpg`. */
export async function uploadPhotos(localUris: string[], onProgress?: (index: number) => void): Promise<string[]> {
  const uid = await ensureSession();
  const stamp = Date.now();
  const paths: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    onProgress?.(i);
    const path = `${uid}/${stamp}_${i}.jpg`;
    const b64 = await FileSystem.readAsStringAsync(localUris[i], { encoding: FileSystem.EncodingType.Base64 });
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage.from('receipts').upload(path, bytes, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}


export type ExtractResult = { extraction: Extraction; model: string; latency_ms: number };

/** Ask the Edge Function to read ONE receipt from 1–4 photos (top to bottom). */
export async function extractReceiptPhotos(imagePaths: string[]): Promise<ExtractResult> {
  const { data, error } = await supabase.functions.invoke('extract-receipt', { body: { image_paths: imagePaths } });
  if (error) {
    let detail = error.message;
    let status: number | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        status = ctx.status;
        const body = await ctx.json();
        detail = body?.error ?? detail;
      }
    } catch { /* keep message */ }
    if (status === 429 || /daily scan limit/i.test(String(detail))) throw new ScanLimitError(String(detail));
    if (error.name === 'FunctionsFetchError') throw new OfflineError(String(detail));
    throw new Error(String(detail));
  }
  if (!data?.extraction) {
    if (/daily scan limit/i.test(String(data?.error ?? ''))) throw new ScanLimitError(String(data.error));
    throw new Error(data?.error ?? 'empty answer');
  }
  return data as ExtractResult;
}

/** Best-effort cleanup of photos that were uploaded but never attached to a saved receipt. */
export async function removeUploaded(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try { await supabase.storage.from('receipts').remove(paths); } catch { /* ignore */ }
}

/** After saveReceipt (which stores one path) attach the remaining photos to the same row. */
export async function attachExtraPhotos(receiptId: string, imagePaths: string[]): Promise<void> {
  if (imagePaths.length <= 1) return;
  const { error } = await supabase.from('receipts').update({ image_path: joinImagePaths(imagePaths) }).eq('id', receiptId);
  if (error) throw new Error(error.message);
}
