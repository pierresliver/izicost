// Everything the screens need to talk to the backend, in one place.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { ensureSession, supabase } from './supabase';
import type { Extraction, ReceiptItemRow, ReceiptRow } from './types';

/** Shrink the photo so a scan costs little data: max 1600 px on the long side, JPEG 80%. */
export async function prepareImage(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return out.uri;
}

/** Upload to the private bucket under the user's own folder. Returns the storage path. */
export async function uploadImage(localUri: string): Promise<string> {
  const uid = await ensureSession();
  const path = `${uid}/${Date.now()}.jpg`;
  const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from('receipts').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}

/** Ask the server function (which holds the AI key) to read the receipt. */
export async function extractReceipt(imagePath: string): Promise<{ extraction: Extraction; model: string; latency_ms: number }> {
  const { data, error } = await supabase.functions.invoke('extract-receipt', { body: { image_path: imagePath } });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) detail = (await ctx.json()).error ?? detail;
    } catch { /* keep message */ }
    throw new Error(detail);
  }
  if (!data?.extraction) throw new Error(data?.error ?? 'empty answer');
  return data;
}

function nameKey(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Find or create the store row for this branch. */
async function upsertStore(x: Extraction): Promise<string | null> {
  if (!x.store_name) return null;
  const key = nameKey(x.store_name);
  const taxId = x.store_tax_id ? x.store_tax_id.replace(/\D/g, '') : null;
  const address = x.store_branch_address?.trim() || null;
  let q = supabase.from('stores').select('id').eq('name_key', key);
  q = taxId ? q.eq('tax_id', taxId) : q.is('tax_id', null);
  q = address ? q.eq('branch_address', address) : q.is('branch_address', null);
  const { data: found } = await q.limit(1).maybeSingle();
  if (found?.id) return found.id;
  const { data: created, error } = await supabase
    .from('stores')
    .insert({ name: x.store_name.trim(), name_key: key, branch_address: address, tax_id: taxId, store_type: x.store_type || null, country: x.country || null })
    .select('id')
    .single();
  if (error) return null; // a store row is nice-to-have; never block saving the receipt
  return created.id;
}

/** Save a confirmed receipt and its lines. Returns the new receipt id. */
export async function saveReceipt(x: Extraction, imagePath: string, raw: Extraction, model: string): Promise<string> {
  const uid = await ensureSession();
  const storeId = await upsertStore(x);
  const { data: receipt, error } = await supabase
    .from('receipts')
    .insert({
      user_id: uid,
      store_id: storeId,
      store_name: x.store_name,
      store_branch_address: x.store_branch_address,
      store_tax_id: x.store_tax_id ? x.store_tax_id.replace(/\D/g, '') : null,
      store_type: x.store_type || null,
      doc_type: x.doc_type,
      country: x.country || null,
      currency: x.currency || null,
      receipt_number: x.receipt_number,
      purchased_on: x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null,
      purchased_at_time: x.time && /^\d{2}:\d{2}/.test(x.time) ? x.time.slice(0, 5) : null,
      subtotal: x.subtotal,
      tax_total: x.tax_total,
      discount_total: x.discount_total ?? 0,
      total: x.total,
      payment_method: x.payment_method,
      image_path: imagePath,
      legibility: x.legibility,
      notes: x.notes || null,
      raw_extraction: raw,
      model,
      confirmed: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (x.items.length) {
    const rows = x.items.map((it, i) => ({
      receipt_id: receipt.id,
      user_id: uid,
      line_no: i + 1,
      name_as_printed: it.name,
      product_name: it.name,
      qty: it.qty,
      unit_price: it.unit_price,
      line_total: it.line_total,
      category: it.category,
      subcategory: it.subcategory,
    }));
    const { error: itemErr } = await supabase.from('receipt_items').insert(rows);
    if (itemErr) throw new Error(itemErr.message);
  }
  return receipt.id;
}

export async function listReceipts(): Promise<ReceiptRow[]> {
  await ensureSession();
  const { data, error } = await supabase
    .from('receipts')
    .select('id, store_name, store_branch_address, store_type, currency, purchased_on, total, payment_method, image_path, created_at, receipt_items(count)')
    .order('purchased_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const { receipt_items, ...rest } = r as ReceiptRow & { receipt_items: { count: number }[] };
    return { ...rest, item_count: receipt_items?.[0]?.count ?? 0 };
  });
}

export async function getReceipt(id: string): Promise<{ receipt: ReceiptRow & { notes: string | null; store_tax_id: string | null; tax_total: number | null }; items: ReceiptItemRow[] }> {
  const { data: receipt, error } = await supabase.from('receipts').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  const { data: items, error: e2 } = await supabase.from('receipt_items').select('*').eq('receipt_id', id).order('line_no');
  if (e2) throw new Error(e2.message);
  return { receipt, items: items ?? [] };
}

export async function deleteReceipt(id: string, imagePath: string | null): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (imagePath) await supabase.storage.from('receipts').remove([imagePath]);
}

export async function signedImageUrl(imagePath: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(imagePath, 3600);
  return data?.signedUrl ?? null;
}

export type MonthSummary = {
  total: number;
  count: number;
  currency: string;
  byStore: { name: string; total: number }[];
  byCategory: { name: string; total: number }[];
};

/** Totals for the current calendar month, in the most common currency of those receipts. */
export async function monthSummary(): Promise<MonthSummary> {
  await ensureSession();
  const now = new Date();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const from = ym(now);
  const to = ym(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const { data: receipts } = await supabase
    .from('receipts')
    .select('id, store_name, currency, total')
    .gte('purchased_on', from)
    .lt('purchased_on', to);
  const rows = receipts ?? [];
  const currencyCount: Record<string, number> = {};
  for (const r of rows) currencyCount[r.currency ?? '?'] = (currencyCount[r.currency ?? '?'] ?? 0) + 1;
  const currency = Object.entries(currencyCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'MZN';
  const inCur = rows.filter((r) => (r.currency ?? '?') === currency);
  const byStoreMap: Record<string, number> = {};
  for (const r of inCur) byStoreMap[r.store_name ?? '?'] = (byStoreMap[r.store_name ?? '?'] ?? 0) + (r.total ?? 0);
  const ids = inCur.map((r) => r.id);
  const byCategoryMap: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await supabase.from('receipt_items').select('category, line_total').in('receipt_id', ids);
    for (const it of items ?? []) byCategoryMap[it.category ?? 'other'] = (byCategoryMap[it.category ?? 'other'] ?? 0) + (it.line_total ?? 0);
  }
  const sortDesc = (m: Record<string, number>) => Object.entries(m).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  return {
    total: inCur.reduce((s, r) => s + (r.total ?? 0), 0),
    count: inCur.length,
    currency,
    byStore: sortDesc(byStoreMap).slice(0, 5),
    byCategory: sortDesc(byCategoryMap).slice(0, 6),
  };
}

export function formatMoney(n: number | null | undefined, currency?: string | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const s = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${s} ${currency}` : s;
}
