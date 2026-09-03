// Text search over receipts (store name) and items (name), with a date range.
import { scopeUserId } from '@/features/household/api';
import { supabase } from '@/lib/supabase';

import { addDays, iso, monthStart, ym } from './dates';

export type SearchRange = 'month' | '3months' | 'all';

export type SearchHit = {
  id: string;           // unique per row
  receiptId: string;
  kind: 'receipt' | 'item';
  title: string;        // store name or item name
  subtitle: string;     // "store" for items
  date: string;
  amount: number | null;
  currency: string | null;
};

function rangeStart(range: SearchRange): string | null {
  const now = new Date();
  if (range === 'month') return monthStart(ym(now));
  if (range === '3months') return iso(addDays(now, -90));
  return null;
}

function pattern(q: string): string {
  return `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

export async function search(q: string, range: SearchRange): Promise<SearchHit[]> {
  const me = await scopeUserId(); // follows the Me / Household switch
  const from = rangeStart(range);
  const pat = pattern(q);

  let rq = supabase.from('receipts').select('id, store_name, currency, total, purchased_on').ilike('store_name', pat).limit(50);
  if (me) rq = rq.eq('user_id', me);
  if (from) rq = rq.gte('purchased_on', from);
  let iq = supabase
    .from('receipt_items')
    .select('id, receipt_id, name_as_printed, line_total, receipts!inner(purchased_on, store_name, currency)')
    .ilike('name_as_printed', pat)
    .limit(80);
  if (me) iq = iq.eq('user_id', me);
  if (from) iq = iq.gte('receipts.purchased_on', from);

  const [r, i] = await Promise.all([rq, iq]);
  if (r.error) throw new Error(r.error.message);
  if (i.error) throw new Error(i.error.message);

  type RRow = { id: string; store_name: string | null; currency: string | null; total: number | null; purchased_on: string | null };
  type IRow = { id: string; receipt_id: string; name_as_printed: string; line_total: number | null; receipts: { purchased_on: string | null; store_name: string | null; currency: string | null } | null };

  const hits: SearchHit[] = [];
  for (const x of (r.data ?? []) as RRow[]) {
    hits.push({ id: `r-${x.id}`, receiptId: x.id, kind: 'receipt', title: x.store_name ?? '?', subtitle: '', date: x.purchased_on ?? '', amount: x.total, currency: x.currency });
  }
  for (const x of (i.data ?? []) as unknown as IRow[]) {
    hits.push({
      id: `i-${x.id}`, receiptId: x.receipt_id, kind: 'item', title: x.name_as_printed,
      subtitle: x.receipts?.store_name ?? '?', date: x.receipts?.purchased_on ?? '', amount: x.line_total, currency: x.receipts?.currency ?? null,
    });
  }
  return hits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
