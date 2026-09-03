// "My items" price watch: the user's own list (RLS), enriched server-side from the anonymised pool.
import { ensureSession, supabase } from '@/lib/supabase';

export type WatchRow = {
  watch_id: string; product_id: string; product_key: string; display_name: string; size_value: number | null; size_unit: string | null;
  currency: string; notify: boolean; source: 'auto' | 'pinned';
  best_price: number | null; best_store: string | null; best_city: string | null; best_on: string | null; best_reports: number | null; best_point: number | null;
  min_60: number | null; median_recent: number | null; median_before: number | null;
  my_last_price: number | null; my_last_on: string | null; my_last_store: string | null;
  last_notified_price: number | null; spark: number[];
};

/** How the current best price compares with the baseline (your last price, else the community median before). */
export type Tone = 'down' | 'up' | 'flat' | 'new';
export type Movement = { tone: Tone; pct: number | null; baseline: number | null; baselineKind: 'mine' | 'community' | null; lowest: boolean };

const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function watchlist(): Promise<WatchRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('watchlist_overview');
  if (error) throw new Error(error.message);
  return ((data ?? []) as WatchRow[]).map((r) => ({
    ...r,
    size_value: numOrNull(r.size_value), best_price: numOrNull(r.best_price), best_reports: numOrNull(r.best_reports),
    min_60: numOrNull(r.min_60), median_recent: numOrNull(r.median_recent), median_before: numOrNull(r.median_before),
    my_last_price: numOrNull(r.my_last_price), last_notified_price: numOrNull(r.last_notified_price),
    spark: Array.isArray(r.spark) ? r.spark.map(Number).filter((n) => Number.isFinite(n)) : [],
  }));
}

/** Fill the list from what the user buys often. Returns how many items were added. */
export async function autofill(limit = 8): Promise<number> {
  await ensureSession();
  const { data, error } = await supabase.rpc('watchlist_autofill', { p_limit: limit });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export function movement(r: WatchRow): Movement {
  const lowest = r.best_price !== null && r.min_60 !== null && r.best_price <= r.min_60 + 0.005;
  const baseline = r.my_last_price ?? r.median_before ?? null;
  const baselineKind = r.my_last_price !== null ? 'mine' : r.median_before !== null ? 'community' : null;
  if (r.best_price === null || baseline === null || baseline <= 0) return { tone: 'new', pct: null, baseline, baselineKind, lowest };
  const pct = ((r.best_price - baseline) / baseline) * 100;
  const tone: Tone = pct <= -2 ? 'down' : pct >= 2 ? 'up' : 'flat';
  return { tone, pct, baseline, baselineKind, lowest };
}

/** A drop worth telling the user about: cheaper than the baseline and cheaper than the last time we told them. */
export function isNewDrop(r: WatchRow): boolean {
  if (!r.notify || r.best_price === null) return false;
  if (movement(r).tone !== 'down') return false;
  return r.last_notified_price === null || r.best_price < r.last_notified_price - 0.005;
}

export async function setNotify(watchId: string, notify: boolean): Promise<void> {
  const { error } = await supabase.from('watch_items').update({ notify }).eq('id', watchId);
  if (error) throw new Error(error.message);
}

export async function markNotified(watchId: string, price: number): Promise<void> {
  const { error } = await supabase.from('watch_items').update({ last_notified_price: price, last_notified_at: new Date().toISOString() }).eq('id', watchId);
  if (error) throw new Error(error.message);
}

/** Hide (never auto-added again). */
export async function unwatch(watchId: string): Promise<void> {
  const { error } = await supabase.from('watch_items').update({ hidden: true, source: 'pinned' }).eq('id', watchId);
  if (error) throw new Error(error.message);
}

/** Pin a product (product page). Un-hides if it was removed before. */
export async function watchProduct(productId: string, currency: string): Promise<void> {
  const uid = await ensureSession();
  const { error } = await supabase.from('watch_items')
    .upsert({ user_id: uid, product_id: productId, currency, source: 'pinned', hidden: false, notify: true }, { onConflict: 'user_id,product_id,currency' });
  if (error) throw new Error(error.message);
}

/** Is this product on my list (and not hidden)? Returns the watch row id or null. */
export async function watchIdFor(productId: string, currency: string): Promise<string | null> {
  const uid = await ensureSession();
  const { data, error } = await supabase.from('watch_items').select('id').eq('user_id', uid).eq('product_id', productId).eq('currency', currency).eq('hidden', false).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
