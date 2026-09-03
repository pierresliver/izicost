// Category and store reports (overview lists + one-entity detail).
import { scopeUserId } from '@/features/household/api';
import { ensureSession, supabase } from '@/lib/supabase';

import { fetchItemsFor, fetchReceipts, groupSlices, pickCurrency, type MonthPoint, type ReceiptLite, type ScopeOpts, type Slice } from './api';
import { lastMonths, monthStart } from './dates';

/** A receipt_items row joined to its receipt (date, store, currency). */
export type JoinedItem = {
  receipt_id: string;
  name_as_printed: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  category: string | null;
  subcategory: string | null;
  receipts: { purchased_on: string | null; store_name: string | null; currency: string | null } | null;
};

/** Items with their receipt's date/store, from `from` (inclusive) on. Optional category filter. */
export async function fetchJoinedItems(from: string, category?: string, limit = 1500, opts: ScopeOpts = {}): Promise<JoinedItem[]> {
  const me = opts.onlyMe ? await ensureSession() : await scopeUserId();
  let q = supabase
    .from('receipt_items')
    .select('receipt_id, name_as_printed, qty, unit_price, line_total, category, subcategory, receipts!inner(purchased_on, store_name, currency)')
    .gte('receipts.purchased_on', from)
    .order('purchased_on', { referencedTable: 'receipts', ascending: false })
    .limit(limit);
  if (me) q = q.eq('user_id', me);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as JoinedItem[];
}

export type CategoryOverview = { currency: string; months: string[]; categories: { name: string; thisMonth: number; trend: number[] }[] };

export async function loadCategoryOverview(): Promise<CategoryOverview> {
  const months = lastMonths(6);
  const items = await fetchJoinedItems(monthStart(months[0]));
  const currency = pickCurrency(items.map((i) => ({ currency: i.receipts?.currency ?? null })));
  const inCur = items.filter((i) => (i.receipts?.currency ?? '?') === currency);
  const byCat: Record<string, number[]> = {};
  for (const it of inCur) {
    const m = (it.receipts?.purchased_on ?? '').slice(0, 7);
    const idx = months.indexOf(m);
    if (idx < 0) continue;
    const arr = byCat[it.category ?? 'other'] ?? (byCat[it.category ?? 'other'] = months.map(() => 0));
    arr[idx] += it.line_total ?? 0;
  }
  const categories = Object.entries(byCat)
    .map(([name, trend]) => ({ name, trend, thisMonth: trend[5] }))
    .sort((a, b) => b.thisMonth - a.thisMonth || b.trend.reduce((s, x) => s + x, 0) - a.trend.reduce((s, x) => s + x, 0));
  return { currency, months, categories };
}

export type CategoryItem = { key: string; name: string; store: string; date: string; price: number | null; receiptId: string };
export type CategoryReport = { currency: string; trend: MonthPoint[]; subcategories: Slice[]; items: CategoryItem[] };

export async function loadCategory(category: string): Promise<CategoryReport> {
  const months = lastMonths(6);
  const items = await fetchJoinedItems(monthStart(months[0]), category);
  const currency = pickCurrency(items.map((i) => ({ currency: i.receipts?.currency ?? null })));
  const inCur = items.filter((i) => (i.receipts?.currency ?? '?') === currency);
  const trend: MonthPoint[] = months.map((m) => {
    const rs = inCur.filter((i) => (i.receipts?.purchased_on ?? '').startsWith(m));
    return { ym: m, total: rs.reduce((s, i) => s + (i.line_total ?? 0), 0), count: rs.length };
  });
  const from3 = monthStart(months[3]);
  const recent = inCur.filter((i) => (i.receipts?.purchased_on ?? '') >= from3);
  const subcategories = groupSlices(recent, (i) => i.subcategory || 'other', (i) => i.line_total ?? 0);
  const list = recent
    .map((i, idx) => ({
      key: `${i.receipt_id}-${idx}`,
      name: i.name_as_printed,
      store: i.receipts?.store_name ?? '?',
      date: i.receipts?.purchased_on ?? '',
      price: i.line_total,
      receiptId: i.receipt_id,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { currency, trend, subcategories, items: list };
}

export type StoreOverview = { currency: string; stores: (Slice & { last: string })[] };

export async function loadStoreOverview(): Promise<StoreOverview> {
  const rows = await fetchReceipts();
  const currency = pickCurrency(rows);
  const inCur = rows.filter((r) => (r.currency ?? '?') === currency);
  const lastBy: Record<string, string> = {};
  for (const r of inCur) {
    const k = r.store_name ?? '?';
    if (!lastBy[k] || (r.purchased_on ?? '') > lastBy[k]) lastBy[k] = r.purchased_on ?? '';
  }
  const stores = groupSlices(inCur, (r) => r.store_name ?? '?', (r) => r.total ?? 0).map((s) => ({ ...s, last: lastBy[s.name] ?? '' }));
  return { currency, stores };
}

export type StoreReport = {
  currency: string;
  total: number;
  count: number;
  avgBasket: number;
  avgItems: number;
  trend: MonthPoint[];
  topCategories: Slice[];
  receipts: (ReceiptLite & { item_count: number })[];
};

export async function loadStore(name: string): Promise<StoreReport> {
  const me = await scopeUserId();
  let q = supabase
    .from('receipts')
    .select('id, user_id, store_name, currency, total, purchased_on, receipt_items(count)')
    .eq('store_name', name)
    .order('purchased_on', { ascending: false, nullsFirst: false });
  if (me) q = q.eq('user_id', me);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => {
    const { receipt_items, ...rest } = r as ReceiptLite & { receipt_items: { count: number }[] };
    return { ...rest, item_count: receipt_items?.[0]?.count ?? 0 };
  });
  const currency = pickCurrency(rows);
  const inCur = rows.filter((r) => (r.currency ?? '?') === currency);
  const months = lastMonths(6);
  const trend: MonthPoint[] = months.map((m) => {
    const rs = inCur.filter((r) => (r.purchased_on ?? '').startsWith(m));
    return { ym: m, total: rs.reduce((s, r) => s + (r.total ?? 0), 0), count: rs.length };
  });
  const total = inCur.reduce((s, r) => s + (r.total ?? 0), 0);
  const recentIds = inCur.filter((r) => (r.purchased_on ?? '') >= monthStart(months[3])).map((r) => r.id);
  const items = recentIds.length ? await fetchItemsFor(recentIds) : [];
  return {
    currency,
    total,
    count: inCur.length,
    avgBasket: inCur.length ? total / inCur.length : 0,
    avgItems: inCur.length ? inCur.reduce((s, r) => s + r.item_count, 0) / inCur.length : 0,
    trend,
    topCategories: groupSlices(items, (i) => i.category ?? 'other', (i) => i.line_total ?? 0).slice(0, 5),
    receipts: rows,
  };
}
