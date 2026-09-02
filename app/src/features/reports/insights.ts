// Recurring-item radar and personal inflation, both computed from receipt_items history.
import { addDays, daysBetween, iso } from './dates';
import { fetchJoinedItems } from './detail';

export type HistoryRow = {
  key: string;            // normalised name
  name: string;           // as printed, last seen spelling
  date: string;           // 'YYYY-MM-DD'
  store: string;
  currency: string;
  price: number | null;   // unit price (falls back to line_total / qty, then line_total)
  receiptId: string;
};

/** lowercase, strip accents and punctuation, collapse spaces: "Leite  UHT, 1L" -> "leite uht 1l". */
export function normaliseName(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function fetchHistory(days = 180): Promise<HistoryRow[]> {
  const rows = await fetchJoinedItems(iso(addDays(new Date(), -days)));
  return rows
    .filter((r) => r.receipts?.purchased_on && r.name_as_printed)
    .map((r) => {
      const qty = r.qty && r.qty > 0 ? r.qty : null;
      const price = r.unit_price ?? (r.line_total != null ? (qty ? r.line_total / qty : r.line_total) : null);
      return {
        key: normaliseName(r.name_as_printed),
        name: r.name_as_printed.trim(),
        date: r.receipts!.purchased_on!,
        store: r.receipts!.store_name ?? '?',
        currency: r.receipts!.currency ?? '?',
        price,
        receiptId: r.receipt_id,
      };
    })
    .filter((r) => r.key.length >= 2)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function groupByKey(rows: HistoryRow[]): Map<string, HistoryRow[]> {
  const m = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const arr = m.get(r.key) ?? [];
    arr.push(r);
    m.set(r.key, arr);
  }
  return m;
}

export type Recurring = {
  key: string;
  name: string;
  everyDays: number;
  times: number;
  lastDate: string;
  lastPrice: number | null;
  lastStore: string;
  currency: string;
  dueOn: string;
  daysUntilDue: number;   // negative = overdue
};

/**
 * Items bought on >= 3 distinct days whose gaps are fairly regular (coefficient of variation <= 0.6)
 * and between 2 and 60 days. Sorted by due date, soonest first.
 */
export function detectRecurring(rows: HistoryRow[], today = iso(new Date())): Recurring[] {
  const out: Recurring[] = [];
  for (const [key, list] of groupByKey(rows)) {
    const dates = [...new Set(list.map((r) => r.date))].sort();
    if (dates.length < 3) continue;
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).filter((g) => g > 0);
    if (gaps.length < 2) continue;
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (mean < 2 || mean > 60) continue;
    const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length);
    if (sd / mean > 0.6) continue;
    const last = list[list.length - 1];
    const every = Math.round(mean);
    const dueOn = iso(addDays(new Date(last.date), every));
    const daysUntilDue = daysBetween(today, dueOn);
    // show when due within 3 days, or overdue by less than one more cycle
    if (daysUntilDue > 3 || daysUntilDue < -every) continue;
    out.push({
      key, name: last.name, everyDays: every, times: dates.length, lastDate: last.date,
      lastPrice: last.price, lastStore: last.store, currency: last.currency, dueOn, daysUntilDue,
    });
  }
  return out.sort((a, b) => a.daysUntilDue - b.daysUntilDue).slice(0, 8);
}

export type InflationItem = {
  key: string;
  name: string;
  times: number;
  now: number | null;
  before: number | null;   // median price 30–90 days before the latest purchase
  changePct: number | null;
  currency: string;
  store: string;
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** "Your basket": the 10 most-bought items, latest price vs 1–3 months earlier. */
export function personalInflation(rows: HistoryRow[]): { items: InflationItem[]; overallPct: number | null; currency: string } {
  const currency = rows.length ? [...groupByKey(rows.map((r) => ({ ...r, key: r.currency })))].sort((a, b) => b[1].length - a[1].length)[0][0] : 'MZN';
  const inCur = rows.filter((r) => r.currency === currency && r.price != null && r.price > 0);
  const groups = [...groupByKey(inCur)].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  const items: InflationItem[] = groups.map(([key, list]) => {
    const latest = list[list.length - 1];
    const lo = iso(addDays(new Date(latest.date), -90)), hi = iso(addDays(new Date(latest.date), -30));
    const before = median(list.filter((r) => r.date >= lo && r.date <= hi).map((r) => r.price!));
    const now = latest.price;
    const changePct = before && now ? ((now - before) / before) * 100 : null;
    return { key, name: latest.name, times: list.length, now, before, changePct, currency, store: latest.store };
  });
  const changes = items.map((i) => i.changePct).filter((x): x is number => x != null);
  const overallPct = changes.length ? changes.reduce((s, x) => s + x, 0) / changes.length : null;
  return { items, overallPct, currency };
}
