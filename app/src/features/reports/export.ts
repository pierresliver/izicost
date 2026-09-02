// CSV export of every receipt and its lines, shared through the system share sheet.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ensureSession, supabase } from '@/lib/supabase';

import { iso } from './dates';

type R = {
  id: string; purchased_on: string | null; purchased_at_time: string | null; store_name: string | null; store_branch_address: string | null;
  store_type: string | null; currency: string | null; subtotal: number | null; tax_total: number | null; discount_total: number | null;
  total: number | null; payment_method: string | null; receipt_number: string | null;
};
type I = {
  receipt_id: string; line_no: number; name_as_printed: string; qty: number | null; unit_price: number | null;
  line_total: number | null; category: string | null; subcategory: string | null;
};

const HEAD = [
  'receipt_id', 'date', 'time', 'store', 'branch', 'store_type', 'currency', 'receipt_total', 'subtotal', 'tax', 'discount', 'payment', 'receipt_number',
  'line_no', 'item', 'qty', 'unit_price', 'line_total', 'category', 'subcategory',
];

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // A cell starting with = + - @ would run as a formula in Excel (CSV injection); neutralise it.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function buildCsv(): Promise<{ csv: string; receipts: number }> {
  await ensureSession();
  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('id, purchased_on, purchased_at_time, store_name, store_branch_address, store_type, currency, subtotal, tax_total, discount_total, total, payment_method, receipt_number')
    .order('purchased_on', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  const { data: items, error: e2 } = await supabase
    .from('receipt_items')
    .select('receipt_id, line_no, name_as_printed, qty, unit_price, line_total, category, subcategory')
    .order('line_no');
  if (e2) throw new Error(e2.message);

  const byReceipt = new Map<string, I[]>();
  for (const it of (items ?? []) as I[]) {
    const arr = byReceipt.get(it.receipt_id) ?? [];
    arr.push(it);
    byReceipt.set(it.receipt_id, arr);
  }
  const lines = [HEAD.join(',')];
  for (const r of (receipts ?? []) as R[]) {
    const head = [r.id, r.purchased_on, r.purchased_at_time, r.store_name, r.store_branch_address, r.store_type, r.currency, r.total, r.subtotal, r.tax_total, r.discount_total, r.payment_method, r.receipt_number];
    const its = byReceipt.get(r.id) ?? [];
    if (!its.length) lines.push([...head, '', '', '', '', '', '', ''].map(cell).join(','));
    for (const it of its) lines.push([...head, it.line_no, it.name_as_printed, it.qty, it.unit_price, it.line_total, it.category, it.subcategory].map(cell).join(','));
  }
  return { csv: '﻿' + lines.join('\r\n'), receipts: (receipts ?? []).length }; // BOM so Excel opens it as UTF-8
}

/** Writes the CSV to the cache directory and opens the share sheet. Returns the receipt count (0 = nothing to share). */
export async function exportCsv(dialogTitle: string): Promise<number> {
  const { csv, receipts } = await buildCsv();
  if (!receipts) return 0;
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  const file = new File(Paths.cache, `izicost-${iso(new Date())}.csv`);
  if (file.exists) file.delete();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle });
  return receipts;
}
