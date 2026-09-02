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
  const { error } = await supabase.from('price_alerts').insert({ user_id: uid, product_id: productId, currency, target_price: targetPrice });
  if (error) throw new Error(error.message);
}
