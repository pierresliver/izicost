// Spoken / typed list -> structured items -> matched to the community catalogue.
// The server function (Sonnet 5) does the language work; a small local splitter covers the case
// where the function cannot be reached.
import type { Lang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

import { searchProducts, type ProductHit } from './api';

export type ParsedItem = { name: string; qty: number; size: string | null };
export type MatchedItem = ParsedItem & {
  /** Display text for the basket line ("arroz 5kg"). */
  label: string;
  /** Catalogue product when one clearly matches; null = free text (still quoted by name fingerprint). */
  product: ProductHit | null;
};

export class ParseLimitError extends Error {
  constructor(message = 'daily limit reached') { super(message); this.name = 'ParseLimitError'; }
}

/** Ask the Edge Function. Throws on network / server errors so the caller can fall back locally. */
export async function parseWithServer(text: string, lang: Lang): Promise<ParsedItem[]> {
  const { data, error } = await supabase.functions.invoke('parse-shopping-list', { body: { text, lang } });
  if (error) {
    let detail = error.message; let status: number | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) { status = ctx.status; detail = (await ctx.json())?.error ?? detail; }
    } catch { /* keep message */ }
    if (status === 429) throw new ParseLimitError(String(detail));
    throw new Error(String(detail));
  }
  if (!Array.isArray(data?.items)) throw new Error(data?.error ?? 'empty answer');
  return (data.items as ParsedItem[]).map(cleanItem).filter((it) => it.name);
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  meia: 0.5, meio: 0.5, dúzia: 12, duzia: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, dozen: 12, a: 1, an: 1,
};
const UNITS = 'kg|kgs|quilos?|kilos?|g|gr|gramas?|grams?|l|lt|litros?|liters?|litres?|ml';
const FILLER = /^(preciso de|precisamos de|quero|comprar|também|tambem|e|i need|we need|buy|get|and|please|por favor)\s+/i;

function unitOf(u: string): string {
  const s = u.toLowerCase();
  if (/^(kg|quilo|kilo)/.test(s)) return 'kg';
  if (/^(g|gr)/.test(s)) return 'g';
  if (/^ml/.test(s)) return 'ml';
  return 'L';
}
const fmtNum = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Offline fallback: split on commas / "e" / "and", read leading counts ("três", "uma dúzia", "2"),
 * turn a count followed by a unit word into a size ("dois quilos de arroz" -> arroz 2kg), and pick up
 * inline sizes ("rice 5 kg"). Good enough to review and correct by hand.
 */
export function parseLocally(text: string): ParsedItem[] {
  const parts = text
    .split(/[,;\n]|\s+e\s+|\s+and\s+|\s+(?:também|tambem|depois|then|plus|mais)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: ParsedItem[] = [];
  for (let p of parts) {
    for (let guard = 0; guard < 3 && FILLER.test(p); guard++) p = p.replace(FILLER, '').trim();
    // leading count(s): "2", "três", "uma dúzia" (= 1 × 12), "meia dúzia" (= 0.5 × 12)
    let qty = 1; let counted = false;
    for (let guard = 0; guard < 3; guard++) {
      const m = p.match(/^(\d+(?:[.,]\d+)?|\p{L}+)\s+(.*)$/u);
      if (!m) break;
      const n = /^\d/.test(m[1]) ? Number(m[1].replace(',', '.')) : NUMBER_WORDS[m[1].toLowerCase()];
      if (n === undefined || Number.isNaN(n)) break;
      qty = counted ? qty * n : n; counted = true; p = m[2].trim();
    }
    let size: string | null = null;
    // a unit word right after the count means the count was a weight/volume: "2 quilos de arroz"
    const um = p.match(new RegExp(`^(${UNITS})\\b\\s*(?:de|of)?\\s*`, 'i'));
    if (um && counted) { size = `${fmtNum(qty)}${unitOf(um[1])}`; qty = 1; p = p.slice(um[0].length).trim(); }
    // an inline size with digits: "arroz 5 kg", "milk 1L"
    const sz = p.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?(${UNITS})\\b`, 'i'));
    if (sz && !size) {
      size = `${sz[1].replace(',', '.')}${unitOf(sz[2])}`;
      p = (p.slice(0, sz.index) + p.slice((sz.index ?? 0) + sz[0].length)).replace(/\s+(de|of)\s*$/i, '').trim();
    }
    p = p.replace(/^(de|of)\s+/i, '').replace(/\s+/g, ' ').trim();
    if (p) out.push(cleanItem({ name: p, qty: qty > 0 && Number.isInteger(qty) ? qty : Math.max(1, Math.round(qty)), size }));
  }
  return out.slice(0, 60);
}

function cleanItem(it: ParsedItem): ParsedItem {
  return {
    name: String(it.name ?? '').trim().slice(0, 80),
    qty: Number.isFinite(it.qty) && it.qty > 0 ? Math.min(it.qty, 1000) : 1,
    size: it.size ? String(it.size).replace(/\s+/g, '').slice(0, 20) : null,
  };
}

function norm(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** "5kg" -> { value: 5, unit: 'kg' }; litres normalised to 'l'. */
function parseSize(size: string | null): { value: number; unit: string } | null {
  if (!size) return null;
  const m = size.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)$/);
  if (!m) return null;
  const unit = m[2].toLowerCase();
  const u = unit === 'kg' ? 'kg' : unit === 'g' ? 'g' : unit === 'ml' ? 'ml' : /^l/.test(unit) ? 'l' : unit;
  return { value: Number(m[1].replace(',', '.')), unit: u };
}

function sameSize(want: { value: number; unit: string } | null, hit: ProductHit): boolean {
  if (!want) return true;
  if (hit.size_value === null || !hit.size_unit) return false;
  return Math.abs(hit.size_value - want.value) < 0.001 && hit.size_unit.toLowerCase() === want.unit;
}

/**
 * Link each parsed item to a catalogue product when the match is clear: the product name contains
 * every word said, and the size agrees when one was said. Ambiguous = left as free text (the user
 * still gets a quote by name fingerprint, and can pick a product from the autocomplete later).
 */
export async function matchCatalogue(items: ParsedItem[]): Promise<MatchedItem[]> {
  return Promise.all(items.map(async (it) => {
    const label = it.size ? `${it.name} ${it.size}` : it.name;
    let product: ProductHit | null = null;
    try {
      const hits = await searchProducts(it.name, 12);
      const words = norm(it.name).split(' ').filter(Boolean);
      const want = parseSize(it.size);
      const good = hits.filter((h) => {
        const dn = norm(h.display_name);
        return words.every((w) => dn.includes(w)) && sameSize(want, h);
      });
      // exact name match first, then a lone candidate; several candidates = not sure = free text
      product = good.find((h) => norm(h.display_name) === norm(label)) ?? (good.length === 1 ? good[0] : null);
    } catch { /* offline or catalogue error: free text is fine */ }
    return { ...it, label, product };
  }));
}

/**
 * Full pipeline: the server first; when it cannot answer (no internet, server error) the local splitter,
 * flagged with `fallback` so the screen asks the user to check the list.
 */
export async function parseShoppingList(text: string, lang: Lang): Promise<{ items: MatchedItem[]; fallback: boolean }> {
  let parsed: ParsedItem[]; let fallback = false;
  try { parsed = await parseWithServer(text, lang); }
  catch (e) {
    if (e instanceof ParseLimitError) throw e;
    parsed = parseLocally(text); fallback = true;
  }
  return { items: await matchCatalogue(parsed), fallback };
}
