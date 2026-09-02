// Queries for the Home dashboard and the month report. Everything is computed client-side from
// the user's own rows (RLS), which is fine at personal-receipt volumes (hundreds, not millions).
import { ensureSession, supabase } from '@/lib/supabase';

import { addDays, iso, lastMonths, monthEnd, monthStart, ym } from './dates';

export type ReceiptLite = {
  id: string;
  store_name: string | null;
  currency: string | null;
  total: number | null;
  purchased_on: string | null;
};

export type ItemLite = {
  receipt_id: string;
  name_as_printed: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  category: string | null;
  subcategory: string | null;
};

export type Slice = { name: string; total: number; count: number };
export type MonthPoint = { ym: string; total: number; count: number };

/** The currency most receipts use; 'MZN' when there are none. */
export function pickCurrency(rows: { currency: string | null }[]): string {
  const n: Record<string, number> = {};
  for (const r of rows) n[r.currency ?? '?'] = (n[r.currency ?? '?'] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'MZN';
}

/** Totals of receipts NOT in the main currency, for the "also X in other currencies" note. */
export function otherCurrencies(rows: ReceiptLite[], currency: string): { currency: string; total: number }[] {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const c = r.currency ?? '?';
    if (c !== currency) m[c] = (m[c] ?? 0) + (r.total ?? 0);
  }
  return Object.entries(m).map(([currency, total]) => ({ currency, total })).sort((a, b) => b.total - a.total);
}

export function groupSlices<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Slice[] {
  const m: Record<string, Slice> = {};
  for (const r of rows) {
    const k = key(r);
    const s = m[k] ?? (m[k] = { name: k, total: 0, count: 0 });
    s.total += value(r);
    s.count += 1;
  }
  return Object.values(m).sort((a, b) => b.total - a.total);
}

export async function fetchReceipts(from?: string, to?: string): Promise<ReceiptLite[]> {
  await ensureSession();
  let q = supabase.from('receipts').select('id, store_name, currency, total, purchased_on');
  if (from) q = q.gte('purchased_on', from);
  if (to) q = q.lt('purchased_on', to);
  const { data, error } = await q.order('purchased_on', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReceiptLite[];
}

/** Items for a set of receipts, fetched in chunks so the URL stays short. */
export async function fetchItemsFor(ids: string[]): Promise<ItemLite[]> {
  const out: ItemLite[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('receipt_items')
      .select('receipt_id, name_as_printed, qty, unit_price, line_total, category, subcategory')
      .in('receipt_id', ids.slice(i, i + 150));
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as ItemLite[]));
  }
  return out;
}

export async function countAllReceipts(): Promise<number> {
  await ensureSession();
  const { count } = await supabase.from('receipts').select('id', { count: 'exact', head: true });
  return count ?? 0;
}

export type Dashboard = {
  currency: string;
  others: { currency: string; total: number }[];
  months: MonthPoint[];                 // last 6, oldest first
  thisMonth: { total: number; count: number };
  lastMonth: { total: number; count: number };
  deltaPct: number | null;              // null when last month had nothing
  byCategory: Slice[];                  // this month, all categories, sorted desc
  byStore: Slice[];                     // this month, top 5
  week: { current: number; previous: number; currentCount: number };
  receiptsAllTime: number;
};

export async function loadDashboard(): Promise<Dashboard> {
  const now = new Date();
  const months = lastMonths(6, now);
  const [rows, receiptsAllTime] = await Promise.all([
    fetchReceipts(monthStart(months[0]), monthEnd(months[5])),
    countAllReceipts(),
  ]);
  const currency = pickCurrency(rows);
  const inCur = rows.filter((r) => (r.currency ?? '?') === currency);
  const monthOf = (r: ReceiptLite) => (r.purchased_on ?? '').slice(0, 7);

  const monthPoints: MonthPoint[] = months.map((m) => {
    const rs = inCur.filter((r) => monthOf(r) === m);
    return { ym: m, total: rs.reduce((s, r) => s + (r.total ?? 0), 0), count: rs.length };
  });
  const thisMonth = monthPoints[5], lastMonth = monthPoints[4];
  const deltaPct = lastMonth.total > 0 ? ((thisMonth.total - lastMonth.total) / lastMonth.total) * 100 : null;

  const thisRows = inCur.filter((r) => monthOf(r) === ym(now));
  const items = thisRows.length ? await fetchItemsFor(thisRows.map((r) => r.id)) : [];
  const byCategory = groupSlices(items, (it) => it.category ?? 'other', (it) => it.line_total ?? 0);
  const byStore = groupSlices(thisRows, (r) => r.store_name ?? '?', (r) => r.total ?? 0).slice(0, 5);

  const today = iso(now);
  const d7 = iso(addDays(now, -6)), d14 = iso(addDays(now, -13));
  const inWeek = inCur.filter((r) => r.purchased_on && r.purchased_on >= d7 && r.purchased_on <= today);
  const prevWeek = inCur.filter((r) => r.purchased_on && r.purchased_on >= d14 && r.purchased_on < d7);

  return {
    currency,
    others: otherCurrencies(rows, currency),
    months: monthPoints,
    thisMonth: { total: thisMonth.total, count: thisMonth.count },
    lastMonth: { total: lastMonth.total, count: lastMonth.count },
    deltaPct,
    byCategory,
    byStore,
    week: {
      current: inWeek.reduce((s, r) => s + (r.total ?? 0), 0),
      previous: prevWeek.reduce((s, r) => s + (r.total ?? 0), 0),
      currentCount: inWeek.length,
    },
    receiptsAllTime,
  };
}

export type MonthReport = {
  ym: string;
  currency: string;
  others: { currency: string; total: number }[];
  total: number;
  count: number;
  byCategory: Slice[];
  byStore: Slice[];
  receipts: ReceiptLite[];
};

export async function loadMonth(yearMonth: string): Promise<MonthReport> {
  const rows = await fetchReceipts(monthStart(yearMonth), monthEnd(yearMonth));
  const currency = pickCurrency(rows);
  const inCur = rows.filter((r) => (r.currency ?? '?') === currency);
  const items = inCur.length ? await fetchItemsFor(inCur.map((r) => r.id)) : [];
  return {
    ym: yearMonth,
    currency,
    others: otherCurrencies(rows, currency),
    total: inCur.reduce((s, r) => s + (r.total ?? 0), 0),
    count: inCur.length,
    byCategory: groupSlices(items, (it) => it.category ?? 'other', (it) => it.line_total ?? 0),
    byStore: groupSlices(inCur, (r) => r.store_name ?? '?', (r) => r.total ?? 0),
    receipts: rows,
  };
}
