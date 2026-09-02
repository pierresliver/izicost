// Shopping basket — the user's private list (RLS, own rows) and the community basket quote.
// The quote itself reads the ANONYMISED community view; the list never leaves the user's rows.
import { ensureSession, supabase } from '@/lib/supabase';

export type BasketList = { id: string; name: string };
export type BasketItem = {
  id: string; list_id: string; product_id: string | null; name: string; qty: number; checked: boolean; created_at: string;
  product_key: string | null;
};
export type ProductHit = { id: string; product_key: string; display_name: string; size_value: number | null; size_unit: string | null };
export type QuoteItem = { item_id: string; name: string; qty: number; price: number; line_total: number; observed_on: string; report_count: number };
export type StoreQuote = {
  store_id: string; store_name: string; branch_address: string | null; city: string | null; store_type: string | null;
  lat: number | null; lng: number | null; items_found: number; items_total: number; basket_total: number; items: QuoteItem[];
};

function num(v: unknown): number { return typeof v === 'number' ? v : Number(v); }
function numOrNull(v: unknown): number | null { return v === null || v === undefined ? null : num(v); }

const ITEM_COLS = 'id, list_id, product_id, name, qty, checked, created_at, products(product_key)';
type RawItem = Omit<BasketItem, 'product_key' | 'qty'> & { qty: unknown; products: { product_key: string } | { product_key: string }[] | null };
function toItem(r: RawItem): BasketItem {
  const p = Array.isArray(r.products) ? r.products[0] : r.products;
  return { id: r.id, list_id: r.list_id, product_id: r.product_id, name: r.name, qty: num(r.qty), checked: r.checked, created_at: r.created_at, product_key: p?.product_key ?? null };
}

/** The user's one list — created silently the first time. */
export async function getDefaultList(): Promise<BasketList> {
  const uid = await ensureSession();
  const { data } = await supabase.from('shopping_lists').select('id, name').eq('user_id', uid).order('created_at').limit(1).maybeSingle();
  if (data) return data as BasketList;
  const { data: created, error } = await supabase.from('shopping_lists').insert({ user_id: uid, name: 'My basket' }).select('id, name').single();
  if (error || !created) throw new Error(error?.message ?? 'could not create the list');
  return created as BasketList;
}

export async function listItems(listId: string): Promise<BasketItem[]> {
  await ensureSession();
  const { data, error } = await supabase.from('shopping_list_items').select(ITEM_COLS).eq('list_id', listId).order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawItem[]).map(toItem);
}

/**
 * Add an item; when the same product (or the same name) is already on the list its quantity is
 * increased instead, so "add to basket" twice means "two of them".
 */
export async function addItem(listId: string, x: { name: string; productId?: string | null; qty?: number }): Promise<BasketItem> {
  const uid = await ensureSession();
  const name = x.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('empty name');
  const qty = x.qty && x.qty > 0 ? x.qty : 1;
  let q = supabase.from('shopping_list_items').select(ITEM_COLS).eq('list_id', listId).limit(1);
  q = x.productId ? q.eq('product_id', x.productId) : q.ilike('name', name);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    const cur = toItem(existing as unknown as RawItem);
    const { data, error } = await supabase.from('shopping_list_items')
      .update({ qty: cur.qty + qty, checked: false }).eq('id', cur.id).select(ITEM_COLS).single();
    if (error || !data) throw new Error(error?.message ?? 'could not update');
    return toItem(data as unknown as RawItem);
  }
  const { data, error } = await supabase.from('shopping_list_items')
    .insert({ list_id: listId, user_id: uid, product_id: x.productId ?? null, name, qty }).select(ITEM_COLS).single();
  if (error || !data) throw new Error(error?.message ?? 'could not add');
  return toItem(data as unknown as RawItem);
}

/** Product page shortcut: add to the default list. */
export async function addToBasket(name: string, productId?: string | null): Promise<BasketItem> {
  const list = await getDefaultList();
  return addItem(list.id, { name, productId });
}

export async function updateItem(id: string, patch: { qty?: number; checked?: boolean }): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function removeItem(id: string): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function removeChecked(listId: string): Promise<void> {
  const { error } = await supabase.from('shopping_list_items').delete().eq('list_id', listId).eq('checked', true);
  if (error) throw new Error(error.message);
}

/** Autocomplete from the catalogue (exists even before a product has enough reports). */
export async function searchProducts(query: string, limit = 8): Promise<ProductHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await ensureSession();
  const { data, error } = await supabase.from('products')
    .select('id, product_key, display_name, size_value, size_unit').ilike('display_name', `%${q}%`).order('display_name').limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProductHit[]).map((p) => ({ ...p, size_value: numOrNull(p.size_value) }));
}

/** One row per store with at least one of the list's products in the community pool. */
export async function basketQuote(listId: string, city: string | null, currency: string): Promise<StoreQuote[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('basket_quote', { p_list: listId, p_city: city, p_currency: currency });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StoreQuote[]).map((r) => ({
    ...r, lat: numOrNull(r.lat), lng: numOrNull(r.lng), basket_total: num(r.basket_total),
    items: (r.items ?? []).map((i) => ({ ...i, qty: num(i.qty), price: num(i.price), line_total: num(i.line_total) })),
  }));
}
