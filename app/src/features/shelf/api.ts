// Shelf scan — backend calls. Photos go to the private bucket (own folder) exactly like receipts,
// the read-shelf function returns the labels it could read, and save_shelf_scan publishes them
// (validated and capped on the server; only trusted seeders until the feature opens up).
import { OfflineError, removeUploaded, ScanLimitError, uploadPhotos } from '@/features/scan/api';
import type { StoreInfo } from '@/features/prices/api';
import { ensureSession, supabase } from '@/lib/supabase';

export type ShelfCategory = 'food' | 'drink' | 'alcohol' | 'household' | 'personal_care' | 'pharmacy' | 'pet' | 'clothing' | 'electronics' | 'other';
export const SHELF_CATEGORIES: ShelfCategory[] = ['food', 'drink', 'alcohol', 'household', 'personal_care', 'pharmacy', 'pet', 'clothing', 'electronics', 'other'];

export type ShelfItem = {
  name: string;
  brand: string | null;
  size: string | null;
  price: number;
  price_per: 'each' | 'per_kg' | 'per_l';
  promo: boolean;
  category: ShelfCategory;
  subcategory: string;
  confidence: 'high' | 'low';
  /** Position in the walk's photo list (for "photo 7"). */
  photo_index: number;
  /** Typed by hand on the review screen, not read from a photo (published only for trusted seeders). */
  manual?: boolean;
};
export type ShelfPhotoNote = { index: number; readable: boolean; note: string };
export type ShelfReadResult = { store_name_seen: string | null; currency_seen: string | null; photos: ShelfPhotoNote[]; items: ShelfItem[] };

/** May this account use Shelf scan? (trusted seeder, or the feature is open to everyone) */
export async function shelfScanAllowed(): Promise<boolean> {
  try {
    await ensureSession();
    const { data, error } = await supabase.rpc('shelf_scan_allowed');
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export const MAX_SHELF_PHOTOS_PER_READ = 12;

/** Upload prepared photos and ask the server to read the labels. Photos are deleted server-side after reading. */
export async function readShelfPhotos(localUris: string[], hints: { storeName?: string | null; currency?: string | null }, onProgress?: (n: number, total: number) => void): Promise<ShelfReadResult> {
  const batch = localUris.slice(0, MAX_SHELF_PHOTOS_PER_READ);
  const paths = await uploadPhotos(batch, (i) => onProgress?.(i + 1, batch.length));
  const { data, error } = await supabase.functions.invoke('read-shelf', {
    body: { image_paths: paths, store_name: hints.storeName ?? undefined, currency_hint: hints.currency ?? undefined },
  });
  // The server deletes the photos once it has them; if it never got that far, delete them from here.
  if (error || !data?.result) await removeUploaded(paths);
  if (error) {
    let detail = error.message;
    let status: number | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) { status = ctx.status; detail = (await ctx.json())?.error ?? detail; }
    } catch { /* keep message */ }
    if (status === 429 || /limit reached/i.test(String(detail))) throw new ScanLimitError(String(detail));
    if (error.name === 'FunctionsFetchError') throw new OfflineError(String(detail));
    throw new Error(String(detail));
  }
  if (!data?.result) throw new Error(data?.error ?? 'empty answer');
  const r = data.result as ShelfReadResult;
  return {
    store_name_seen: r.store_name_seen ?? null,
    currency_seen: r.currency_seen ?? null,
    photos: Array.isArray(r.photos) ? r.photos : [],
    items: (Array.isArray(r.items) ? r.items : []).filter((it) => it && typeof it.name === 'string' && typeof it.price === 'number' && it.price > 0),
  };
}

export type SaveShelfResult = { scan_id: string; saved: number; published: number };

/** Publish the reviewed lines as anonymous shelf prices for this store. */
export async function saveShelfScan(storeId: string, currency: string, items: ShelfItem[], photoCount: number): Promise<SaveShelfResult> {
  await ensureSession();
  const payload = items.map((it) => ({
    name: it.name.trim(), brand: it.brand?.trim() || null, price: it.price, price_per: it.price_per, promo: it.promo,
    category: it.category, subcategory: it.subcategory || null, manual: it.manual === true,
  }));
  const { data, error } = await supabase.rpc('save_shelf_scan', { p_store: storeId, p_currency: currency, p_items: payload, p_photo_count: photoCount });
  if (error) throw new Error(error.message);
  const row = (data as SaveShelfResult[] | null)?.[0];
  if (!row) throw new Error('no result');
  return { ...row, saved: Number(row.saved), published: Number(row.published) };
}

export type ShelfStats = { scans: number; items: number; published: number };
export async function myShelfStats(): Promise<ShelfStats> {
  await ensureSession();
  const { data, error } = await supabase.rpc('my_shelf_stats');
  if (error) throw new Error(error.message);
  const row = (data as ShelfStats[] | null)?.[0];
  return row ? { scans: Number(row.scans), items: Number(row.items), published: Number(row.published) } : { scans: 0, items: 0, published: 0 };
}

/** Stores whose name matches, for the picker (any city). */
export async function searchStores(query: string, limit = 12): Promise<StoreInfo[]> {
  await ensureSession();
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.from('stores').select('id, name, branch_address, city, country, store_type, lat, lng')
    .ilike('name', `%${q.replace(/[%_\\]/g, ' ')}%`).order('name').limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StoreInfo[];
}

function nameKey(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** A branch we do not know yet: create it (same identity rule as receipts: name + address). */
export async function createStore(name: string, city: string, country: 'MZ' | 'ZA', address?: string | null): Promise<StoreInfo> {
  await ensureSession();
  const cleanName = name.trim().slice(0, 120);
  const key = nameKey(cleanName);
  const branch = (address?.trim() || city.trim()).slice(0, 200) || null;
  if (key.length < 2) throw new Error('store name too short');
  const lookup = () => supabase.from('stores').select('id, name, branch_address, city, country, store_type, lat, lng')
    .eq('name_key', key).is('tax_id', null).eq('branch_address', branch ?? '').limit(1).maybeSingle();
  const { data: found } = await lookup();
  if (found?.id) return found as StoreInfo;
  const { data: created, error } = await supabase.from('stores')
    // city stays null on purpose (the insert policy forbids it): the server derives it from the address text
    .insert({ name: cleanName, name_key: key, branch_address: branch, tax_id: null, store_type: 'supermarket', country })
    .select('id, name, branch_address, city, country, store_type, lat, lng').single();
  if (error) {
    const { data: again } = await lookup();
    if (again?.id) return again as StoreInfo;
    throw new Error(error.message);
  }
  return created as StoreInfo;
}

/** Pin a freshly created store to where the phone is (server only fills empty coordinates). */
export async function pinStore(storeId: string, pos: { lat: number; lng: number }): Promise<void> {
  await supabase.rpc('set_store_location', { p_store: storeId, p_lat: pos.lat, p_lng: pos.lng }).then(() => {}, () => {});
}
