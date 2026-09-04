// Shopping basket — the user's private list (RLS, own rows) and the community basket quote.
// The quote itself reads the ANONYMISED community view; the list never leaves the user's rows.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';

export type BasketList = { id: string; name: string; household_id?: string | null; user_id?: string };
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

const ACTIVE_KEY = 'izicost.basket.activeList';

export type ListRow = BasketList & { item_count: number; household_id: string | null; user_id: string; mine: boolean };

/** Every list the user can use: own lists plus lists shared with the household (RLS decides), oldest first. */
export async function listLists(): Promise<ListRow[]> {
  const uid = await ensureSession();
  const { data, error } = await supabase.from('shopping_lists').select('id, name, household_id, user_id, shopping_list_items(count)').order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (BasketList & { household_id: string | null; user_id: string; shopping_list_items: { count: number }[] })[])
    .map((l) => ({ id: l.id, name: l.name, household_id: l.household_id, user_id: l.user_id, mine: l.user_id === uid, item_count: l.shopping_list_items?.[0]?.count ?? 0 }))
    .sort((a, b) => Number(b.mine) - Number(a.mine)); // my lists first (stable: oldest first within each group)
}

/** Share one of my lists with my household (or stop sharing with null). Only the creator can. */
export async function shareList(id: string, householdId: string | null): Promise<void> {
  const uid = await ensureSession();
  const { data, error } = await supabase.from('shopping_lists').update({ household_id: householdId }).eq('id', id).eq('user_id', uid).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('not your list');
}

/** Price alerts for every item of a list: each product joins "My items" with the bell on. Returns how many. */
export async function watchListItems(listId: string, currency: string | null = null): Promise<number> {
  await ensureSession();
  const { data, error } = await supabase.rpc('watch_list_items', { p_list: listId, p_currency: currency }); // null = the currency my receipts use
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * "Buy again": add the lines of a past receipt to a list. Weights round UP to whole packs (2.4 kg -> 3), the same
 * name on two lines becomes one line, and the 200-item cap is checked first. Returns distinct items added.
 */
export async function addReceiptItems(listId: string, lines: { name: string; qty: number | null }[]): Promise<number> {
  const merged = new Map<string, number>();
  for (const l of lines) {
    const name = l.name.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const qty = l.qty && l.qty > 0 ? Math.max(1, Math.ceil(l.qty)) : 1;
    merged.set(name.toLowerCase(), (merged.get(name.toLowerCase()) ?? 0) + qty);
  }
  const current = (await listItems(listId)).length;
  if (current + merged.size > 200) throw new Error('a basket holds at most 200 items');
  const names = new Map<string, string>();
  for (const l of lines) { const n = l.name.trim().replace(/\s+/g, ' '); if (n) names.set(n.toLowerCase(), n); }
  for (const [key, qty] of merged) await addItem(listId, { name: names.get(key) ?? key, qty });
  return merged.size;
}

export async function createList(name: string): Promise<BasketList> {
  const uid = await ensureSession();
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 60) || 'My basket';
  const { data, error } = await supabase.from('shopping_lists').insert({ user_id: uid, name: clean }).select('id, name').single();
  if (error || !data) throw new Error(error?.message ?? 'could not create the list');
  await setActiveList(data.id);
  return data as BasketList;
}

export async function renameList(id: string, name: string): Promise<void> {
  const uid = await ensureSession();
  const { error } = await supabase.from('shopping_lists').update({ name: name.trim().replace(/\s+/g, ' ').slice(0, 60) || 'My basket' }).eq('id', id).eq('user_id', uid);
  if (error) throw new Error(error.message);
}

export async function deleteList(id: string): Promise<void> {
  const uid = await ensureSession();
  const { error } = await supabase.from('shopping_lists').delete().eq('id', id).eq('user_id', uid);
  if (error) throw new Error(error.message);
  if ((await AsyncStorage.getItem(ACTIVE_KEY).catch(() => null)) === id) await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
}

/** Moves every item of the source lists into the target (quantities add up), deletes the sources. Returns items moved. */
export async function mergeLists(targetId: string, sourceIds: string[]): Promise<number> {
  await ensureSession();
  const { data, error } = await supabase.rpc('merge_shopping_lists', { p_target: targetId, p_sources: sourceIds });
  if (error) throw new Error(error.message);
  await setActiveList(targetId);
  return Number(data ?? 0);
}

export async function setActiveList(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => {});
}

/** The list the basket screen and the quote work on: the remembered one when it is still usable (own or shared), else the default. */
export async function getActiveList(): Promise<BasketList> {
  await ensureSession();
  const remembered = await AsyncStorage.getItem(ACTIVE_KEY).catch(() => null);
  if (remembered) {
    const { data } = await supabase.from('shopping_lists').select('id, name, household_id, user_id').eq('id', remembered).maybeSingle(); // RLS: own or household
    if (data) return data as BasketList;
  }
  return getDefaultList();
}

/** The user's one list — created silently the first time. */
export async function getDefaultList(): Promise<BasketList> {
  const uid = await ensureSession();
  const { data, error: selErr } = await supabase.from('shopping_lists').select('id, name').eq('user_id', uid).order('created_at').limit(1).maybeSingle();
  if (selErr) throw new Error(selErr.message); // a transient failure must not create a second list
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
  const name = x.name.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) throw new Error('empty name');
  const qty = Math.min(x.qty && x.qty > 0 ? x.qty : 1, 1000);
  let q = supabase.from('shopping_list_items').select(ITEM_COLS).eq('list_id', listId).limit(1);
  q = x.productId ? q.eq('product_id', x.productId) : q.eq('name', name); // exact match: "%" and "_" are not wildcards here
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

/** Home screen: how many unticked items are waiting, without creating a list for a brand-new user. */
export async function countOpenItems(): Promise<number> {
  const uid = await ensureSession();
  const { count, error } = await supabase.from('shopping_list_items').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('checked', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Product page shortcut: add to the active list. */
export async function addToBasket(name: string, productId?: string | null): Promise<BasketItem> {
  const list = await getActiveList();
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

/** One row per store with at least one of the list's products in the community pool. `typical` = 60-day medians instead of latest prices. */
export async function basketQuote(listId: string, city: string | null, currency: string, typical = false): Promise<StoreQuote[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('basket_quote', { p_list: listId, p_city: city, p_currency: currency, p_typical: typical });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StoreQuote[]).map((r) => ({
    ...r, lat: numOrNull(r.lat), lng: numOrNull(r.lng), basket_total: num(r.basket_total),
    items: (r.items ?? []).map((i) => ({ ...i, qty: num(i.qty), price: num(i.price), line_total: num(i.line_total) })),
  }));
}
