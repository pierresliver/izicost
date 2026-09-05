// Community prices — every backend call the price screens need.
// Everything read here comes from the ANONYMISED layer (no user ids), except my_last_price,
// which reads the caller's own receipt lines under RLS.
import { ensureSession, supabase } from '@/lib/supabase';

export type SearchRow = {
  product_key: string;
  display_name: string;
  size_value: number | null;
  size_unit: string | null;
  price: number;
  unit_price: number | null;
  currency: string;
  store_name: string;
  city: string | null;
  observed_on: string;
  report_count: number;
  store_count: number;
  last_seen: string;
};

export type CommunityPrice = {
  product_id: string;
  product_key: string;
  display_name: string;
  size_value: number | null;
  size_unit: string | null;
  category: string | null;
  store_id: string;
  store_name: string;
  branch_address: string | null;
  store_type: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  price: number;
  unit_price: number | null;
  median_price: number | null;
  min_price: number | null;
  observed_on: string;
  report_count: number;
  price_point_id: number;
};

export type TrendPoint = { week_start: string; min_price: number; median_price: number; report_count: number };
export type CityRow = { city: string; country: string | null; product_count?: number };
export type NearbyStore = { id: string; name: string; branch_address: string | null; city: string | null; store_type: string | null; distance_km: number };

/** What part of the world a search covers. All fields null = anywhere. */
export type ScopeFilter = { country?: string | null; city?: string | null; storeIds?: string[] | null };

function num(v: unknown): number { return typeof v === 'number' ? v : Number(v); }
function numOrNull(v: unknown): number | null { return v === null || v === undefined ? null : num(v); }

export async function searchPrices(query: string | null, scope: ScopeFilter, limit = 40): Promise<SearchRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('search_prices', {
    p_query: query?.trim() || null,
    p_country: scope.country ?? null,
    p_city: scope.city ?? null,
    p_store_ids: scope.storeIds ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SearchRow[]).map((r) => ({
    ...r, price: num(r.price), unit_price: numOrNull(r.unit_price), size_value: numOrNull(r.size_value),
  }));
}

export async function productPrices(key: string): Promise<CommunityPrice[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('product_prices', { p_key: key });
  if (error) throw new Error(error.message);
  return ((data ?? []) as CommunityPrice[]).map((r) => ({
    ...r, price: num(r.price), unit_price: numOrNull(r.unit_price), median_price: numOrNull(r.median_price),
    min_price: numOrNull(r.min_price), size_value: numOrNull(r.size_value),
  }));
}

export type ProductRow = { id: string; product_key: string; display_name: string; size_value: number | null; size_unit: string | null };

/** The catalogue entry itself (exists even before the k-anonymity threshold is reached). */
export async function getProduct(key: string): Promise<ProductRow | null> {
  await ensureSession();
  const { data } = await supabase.from('products').select('id, product_key, display_name, size_value, size_unit').eq('product_key', key).maybeSingle();
  return data ? { ...(data as ProductRow), size_value: numOrNull(data.size_value) } : null;
}

export async function productTrend(key: string, currency: string, city?: string | null): Promise<TrendPoint[]> {
  const { data, error } = await supabase.rpc('product_trend', { p_key: key, p_currency: currency, p_city: city ?? null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TrendPoint[]).map((r) => ({ ...r, min_price: num(r.min_price), median_price: num(r.median_price) }));
}

/** Cities that currently have community data. */
export async function priceCities(): Promise<CityRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('price_cities');
  if (error) throw new Error(error.message);
  return (data ?? []) as CityRow[];
}

export type StoreInfo = { id: string; name: string; branch_address: string | null; city: string | null; country: string | null; store_type: string | null; lat: number | null; lng: number | null };
export type StoreOverviewRow = {
  product_key: string; display_name: string; size_value: number | null; size_unit: string | null; category: string | null;
  price: number; observed_on: string; report_count: number; city_median: number | null; diff_pct: number | null;
};
export type StoreIndexPoint = { week_start: string; index: number; products: number };

export async function getStore(id: string): Promise<StoreInfo | null> {
  await ensureSession();
  const { data, error } = await supabase.from('stores').select('id, name, branch_address, city, country, store_type, lat, lng').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...(data as StoreInfo), lat: numOrNull(data.lat), lng: numOrNull(data.lng) } : null;
}

/** What one shop charges for each product it sells, against the 30-day median of its city. */
export async function storeOverview(storeId: string, currency = 'MZN'): Promise<StoreOverviewRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('store_overview', { p_store: storeId, p_currency: currency });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StoreOverviewRow[]).map((r) => ({ ...r, size_value: numOrNull(r.size_value), price: Number(r.price), report_count: Number(r.report_count), city_median: numOrNull(r.city_median), diff_pct: numOrNull(r.diff_pct) }));
}

/** How one shop moves its prices over time: weekly index, base 100 at each product's first week there. */
export async function storeIndex(storeId: string, currency = 'MZN'): Promise<StoreIndexPoint[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('store_index', { p_store: storeId, p_currency: currency });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StoreIndexPoint[]).map((r) => ({ ...r, index: Number(r.index), products: Number(r.products) }));
}

export type BrandRow = {
  product_key: string; display_name: string; brand: string | null; size_value: number | null; size_unit: string | null;
  min_price: number | null; median_price: number | null; store_count: number; report_count: number; last_seen: string | null;
};

/** The products behind the same generic name (all brands), with their community prices. */
export async function productBrands(key: string, currency: string, city?: string | null): Promise<BrandRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('product_brands', { p_key: key, p_currency: currency, p_city: city ?? null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BrandRow[]).map((r) => ({
    ...r, size_value: numOrNull(r.size_value), min_price: numOrNull(r.min_price), median_price: numOrNull(r.median_price),
    store_count: Number(r.store_count ?? 0), report_count: Number(r.report_count ?? 0),
  }));
}

export type StoreTrendPoint = { store_id: string; store_name: string; city: string | null; week_start: string; median_price: number; report_count: number };

/** Weekly median price of one product per store, last 180 days ("how each shop moves its price"). */
export async function productStoreTrend(key: string, currency: string): Promise<StoreTrendPoint[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('product_store_trend', { p_key: key, p_currency: currency });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StoreTrendPoint[]).map((r) => ({ ...r, median_price: Number(r.median_price), report_count: Number(r.report_count) }));
}

export type StapleRow = {
  product_key: string; display_name: string; size_value: number | null; size_unit: string | null; category: string | null;
  median_price: number; min_price: number; max_price: number; report_count: number; store_count: number;
  median_before: number | null; change_pct: number | null;
};

/** A city's staples table: median price per product over the last 30 days, spread, counts, change vs the 60 days before. */
export async function cityStaples(city: string, currency = 'MZN'): Promise<StapleRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('city_staples', { p_city: city, p_currency: currency });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StapleRow[]).map((r) => ({
    ...r, size_value: numOrNull(r.size_value), median_price: Number(r.median_price), min_price: Number(r.min_price), max_price: Number(r.max_price),
    report_count: Number(r.report_count), store_count: Number(r.store_count), median_before: numOrNull(r.median_before), change_pct: numOrNull(r.change_pct),
  }));
}

export type TickerRow = { kind: 'move' | 'activity'; city: string; display_name: string | null; product_key: string | null; change_pct: number | null; price: number | null; currency: string | null; n: number };

/** This week's biggest movers per city plus how many prices arrived today. */
export async function communityTicker(limit = 12, city?: string | null): Promise<TickerRow[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('community_ticker', { p_limit: limit, p_city: city ?? null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TickerRow[]).map((r) => ({ ...r, change_pct: numOrNull(r.change_pct), price: numOrNull(r.price), n: Number(r.n) }));
}

export type CityIndexPoint = { city: string; country: string | null; currency: string; month: string; index: number; change_pct: number; products: number };

/** Community price index per city and month (base 100 at the first month), from the anonymised pool. */
export async function cityPriceIndex(months = 6): Promise<CityIndexPoint[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('city_price_index', { p_months: months });
  if (error) throw new Error(error.message);
  return ((data ?? []) as CityIndexPoint[]).map((r) => ({ ...r, index: Number(r.index), change_pct: Number(r.change_pct), products: Number(r.products) }));
}

/** Every known city (reference table), for the quick-add picker. */
export async function allCities(): Promise<CityRow[]> {
  await ensureSession();
  const { data, error } = await supabase.from('cities').select('name, country').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ city: c.name as string, country: c.country as string }));
}

export type MyLastPrice = { price: number; currency: string | null; purchased_on: string | null; store_name: string | null };

export async function myLastPrice(key: string): Promise<MyLastPrice | null> {
  const { data, error } = await supabase.rpc('my_last_price', { p_key: key });
  if (error) throw new Error(error.message);
  const row = (data as MyLastPrice[] | null)?.[0];
  return row ? { ...row, price: num(row.price) } : null;
}

export async function nearbyStores(lat: number, lng: number, km = 10): Promise<NearbyStore[]> {
  const { data, error } = await supabase.rpc('nearby_stores', { p_lat: lat, p_lng: lng, p_km: km });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbyStore[];
}

/** Informal markets already known, for the quick-add autocomplete. */
export async function informalMarkets(query: string): Promise<{ id: string; name: string; city: string | null }[]> {
  let q = supabase.from('stores').select('id, name, city').eq('store_type', 'market_informal').order('name').limit(8);
  if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
  const { data } = await q;
  return (data ?? []) as { id: string; name: string; city: string | null }[];
}

export type QuickAddInput = { name: string; price: number; currency: string; storeName: string; city: string; qty?: number; size?: string | null };

export async function quickAddPrice(x: QuickAddInput): Promise<{ product_key: string; price_point_id: number }> {
  await ensureSession();
  const { data, error } = await supabase.rpc('quick_add_price', {
    p_name: x.name.trim(), p_price: x.price, p_currency: x.currency.trim().toUpperCase(),
    p_store_name: x.storeName.trim(), p_city: x.city.trim(), p_qty: x.qty ?? 1, p_size: x.size?.trim() || null,
  });
  if (error) throw new Error(error.message.includes('rate_limit') ? 'rate_limit' : error.message);
  const row = (data as { product_key: string; price_point_id: number }[] | null)?.[0];
  if (!row) throw new Error('no result');
  return row;
}

/** Anonymous: only the price point and a reason are stored. */
export async function reportPrice(pricePointId: number, reason: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.from('price_reports').insert({ price_point_id: pricePointId, reason: reason.slice(0, 200) });
  if (error) throw new Error(error.message);
}

export async function setPriceAlert(productId: string, currency: string, targetPrice: number): Promise<void> {
  const uid = await ensureSession();
  const { error } = await supabase.from('price_alerts').upsert({ user_id: uid, product_id: productId, currency, target_price: targetPrice }, { onConflict: 'user_id,product_id,currency' });
  if (error) throw new Error(error.message);
}
