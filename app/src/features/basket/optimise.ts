// Pure ranking maths for the basket quote: distance, single-store ranking, and the 2-store split.
import type { QuoteItem, StoreQuote } from './api';

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type RankedQuote = StoreQuote & { distance_km: number | null; coverage: number };

/** Adds distance, drops stores beyond `maxKm` (when a position is known), sorts by coverage then total. */
export function rankQuotes(quotes: StoreQuote[], pos: LatLng | null, maxKm?: number): { ranked: RankedQuote[]; partial: RankedQuote[] } {
  const all = quotes
    .map((q) => ({
      ...q,
      distance_km: pos && q.lat !== null && q.lng !== null ? haversineKm(pos, { lat: q.lat, lng: q.lng }) : null,
      coverage: q.items_total ? q.items_found / q.items_total : 0,
    }))
    .filter((q) => maxKm === undefined || !pos || (q.distance_km !== null && q.distance_km <= maxKm))
    .sort((a, b) => b.items_found - a.items_found || a.basket_total - b.basket_total || (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
  return { ranked: all.filter((q) => q.coverage >= 0.5), partial: all.filter((q) => q.coverage < 0.5) };
}

/** What the best store saves against the runner-up, on the items both of them have. Null when nothing to compare. */
export function savingVsNext(best: StoreQuote | undefined, next: StoreQuote | undefined): number | null {
  if (!best || !next) return null;
  const mine = new Map(best.items.map((i) => [i.item_id, i.line_total]));
  let diff = 0; let common = 0;
  for (const i of next.items) { const m = mine.get(i.item_id); if (m !== undefined) { diff += i.line_total - m; common++; } }
  return common > 0 && diff > 0.005 ? diff : null;
}

export type ItemBest = { item_id: string; name: string; qty: number; store: StoreQuote; price: number; line_total: number };

/** Cheapest store for each item (over every store returned, partial ones included). */
export function bestPerItem(quotes: StoreQuote[]): ItemBest[] {
  const best = new Map<string, ItemBest>();
  for (const s of quotes) for (const i of s.items) {
    const cur = best.get(i.item_id);
    if (!cur || i.line_total < cur.line_total) best.set(i.item_id, { item_id: i.item_id, name: i.name, qty: i.qty, store: s, price: i.price, line_total: i.line_total });
  }
  return Array.from(best.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export type SplitPlan = {
  a: StoreQuote; aItems: QuoteItem[];
  b: StoreQuote; bItems: QuoteItem[];
  total: number; found: number;
  single: StoreQuote;
  /** Money saved against the best single store, on the items that store has. */
  saving: number;
  /** Items the split finds that the single store does not have. */
  extraItems: number;
};

/**
 * Best plan across at most two stores: maximise items found, then minimise the total.
 * Returns null when the split is not better than the best single store.
 */
export function splitPlan(quotes: StoreQuote[], single: StoreQuote | undefined): SplitPlan | null {
  if (!single || quotes.length < 2) return null;
  const mustHave = single.items.map((i) => i.item_id);
  let best: { a: StoreQuote; b: StoreQuote; total: number; found: number } | null = null;
  for (let x = 0; x < quotes.length; x++) for (let y = x + 1; y < quotes.length; y++) {
    const a = quotes[x]; const b = quotes[y];
    const prices = new Map<string, number>();
    for (const i of a.items) prices.set(i.item_id, i.line_total);
    for (const i of b.items) { const p = prices.get(i.item_id); if (p === undefined || i.line_total < p) prices.set(i.item_id, i.line_total); }
    // A split must never lose an item the best single store already had.
    if (!mustHave.every((id) => prices.has(id))) continue;
    let total = 0; for (const v of prices.values()) total += v;
    const found = prices.size;
    if (!best || found > best.found || (found === best.found && total < best.total - 0.005)) best = { a, b, total, found };
  }
  if (!best) return null;
  // Assign each item to the cheaper of the two (ties go to store A).
  const bPrices = new Map(best.b.items.map((i) => [i.item_id, i]));
  const aItems: QuoteItem[] = []; const bItems: QuoteItem[] = [];
  for (const i of best.a.items) { const o = bPrices.get(i.item_id); if (o && o.line_total < i.line_total - 0.005) bItems.push(o); else aItems.push(i); }
  for (const i of best.b.items) if (!best.a.items.some((x) => x.item_id === i.item_id)) bItems.push(i);
  if (aItems.length === 0 || bItems.length === 0) return null; // one store does everything already
  const cheapest = new Map<string, number>();
  for (const i of [...aItems, ...bItems]) cheapest.set(i.item_id, i.line_total);
  let saving = 0;
  for (const i of single.items) { const c = cheapest.get(i.item_id); if (c !== undefined) saving += i.line_total - c; }
  const extraItems = best.found - single.items_found;
  if (saving < 0) return null;                      // never suggest paying more
  if (saving < 0.5 && extraItems <= 0) return null; // not worth a second trip
  // Put the store with more items first so the sentence reads naturally.
  const swap = bItems.length > aItems.length;
  return {
    a: swap ? best.b : best.a, aItems: swap ? bItems : aItems,
    b: swap ? best.a : best.b, bItems: swap ? aItems : bItems,
    total: Math.round(best.total * 100) / 100, found: best.found, single, saving: Math.round(saving * 100) / 100, extraItems,
  };
}

export type FullEstimate = { total: number; filled: number };

/**
 * "What would the whole basket cost here?" For items a store does not have, use the typical (median) line
 * total across the stores that do. Lets a store with 8/10 items be compared fairly with one that has 10/10.
 */
export function estimateFull(quotes: StoreQuote[]): Map<string, FullEstimate> {
  const perItem = new Map<string, number[]>();
  for (const s of quotes) for (const i of s.items) { const arr = perItem.get(i.item_id) ?? []; arr.push(i.line_total); perItem.set(i.item_id, arr); }
  const typical = new Map<string, number>();
  for (const [id, xs] of perItem) { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); typical.set(id, s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); }
  const out = new Map<string, FullEstimate>();
  for (const s of quotes) {
    const have = new Set(s.items.map((i) => i.item_id));
    let extra = 0; let filled = 0;
    for (const [id, t] of typical) if (!have.has(id)) { extra += t; filled++; }
    out.set(s.store_id, { total: Math.round((s.basket_total + extra) * 100) / 100, filled });
  }
  return out;
}

export type TripAdvice = { best: RankedQuote; nearest: RankedQuote; extraKm: number; saving: number; perKm: number; worthIt: boolean };

/**
 * Is the cheapest store worth the extra distance over the nearest one? Compares the two on the items they both
 * have; "worth it" when the saving is at least `minPerKm` per extra kilometre (fuel, time, chapa fare).
 */
export function tripAdvice(ranked: RankedQuote[], minPerKm = 15): TripAdvice | null {
  const best = ranked[0];
  if (!best || best.distance_km === null) return null;
  const nearest = [...ranked].filter((q) => q.distance_km !== null).sort((a, b) => a.distance_km! - b.distance_km!)[0];
  if (!nearest || nearest.store_id === best.store_id) return null;
  const extraKm = best.distance_km - nearest.distance_km!;
  if (extraKm < 0.5) return null;
  const saving = savingVsNext(best, nearest) ?? 0;
  const perKm = saving / extraKm;
  return { best, nearest, extraKm: Math.round(extraKm * 10) / 10, saving: Math.round(saving * 100) / 100, perKm, worthIt: perKm >= minPerKm };
}

/**
 * Price level per store: on average, how far above the cheapest available price (across the stores given) each
 * store is for the items it has. 0 = cheapest on everything it sells; +6 = 6% dearer on average.
 */
export function priceLevel(quotes: StoreQuote[]): Map<string, number | null> {
  const min = new Map<string, number>();
  for (const s of quotes) for (const i of s.items) { const m = min.get(i.item_id); if (m === undefined || i.price < m) min.set(i.item_id, i.price); }
  const out = new Map<string, number | null>();
  for (const s of quotes) {
    let sum = 0, n = 0;
    for (const i of s.items) { const m = min.get(i.item_id); if (m && m > 0) { sum += i.price / m - 1; n++; } }
    out.set(s.store_id, n ? Math.round((sum / n) * 1000) / 10 : null);
  }
  return out;
}

/** Names of list items that no store in scope has a price for. */
export function missingItems(quotes: StoreQuote[], allItems: { id: string; name: string }[]): string[] {
  const seen = new Set<string>();
  for (const s of quotes) for (const i of s.items) seen.add(i.item_id);
  return allItems.filter((i) => !seen.has(i.id)).map((i) => i.name);
}
