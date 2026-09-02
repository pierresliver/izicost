// Price alerts — the caller's own rows (RLS) checked against the anonymised community prices.
import { ensureSession, supabase } from '@/lib/supabase';

export type AlertHit = {
  alert_id: string; product_id: string; product_key: string; display_name: string; currency: string; target_price: number;
  price: number; store_id: string; store_name: string; branch_address: string | null; city: string | null; observed_on: string;
};

export type AlertRow = {
  id: string; product_id: string; currency: string; target_price: number; created_at: string;
  product_key: string | null; display_name: string | null; hit_at: string | null;
};

function num(v: unknown): number { return typeof v === 'number' ? v : Number(v); }

/** Alerts whose product is now at or below the target, not yet shown to the user. */
export async function checkPriceAlerts(): Promise<AlertHit[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc('check_price_alerts');
  if (error) throw new Error(error.message);
  return ((data ?? []) as AlertHit[]).map((r) => ({ ...r, price: num(r.price), target_price: num(r.target_price) }));
}

/** Remember that these hits were shown, so they are not repeated. */
export async function recordHits(alertIds: string[]): Promise<void> {
  if (!alertIds.length) return;
  const { error } = await supabase.from('price_alert_hits').upsert(alertIds.map((alert_id) => ({ alert_id })), { onConflict: 'alert_id' });
  if (error) throw new Error(error.message);
}

type RawAlert = {
  id: string; product_id: string; currency: string; target_price: unknown; created_at: string;
  products: { product_key: string; display_name: string } | { product_key: string; display_name: string }[] | null;
  price_alert_hits: { notified_at: string } | { notified_at: string }[] | null;
};

export async function listAlerts(): Promise<AlertRow[]> {
  const uid = await ensureSession();
  const { data, error } = await supabase.from('price_alerts')
    .select('id, product_id, currency, target_price, created_at, products(product_key, display_name), price_alert_hits(notified_at)')
    .eq('user_id', uid).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawAlert[]).map((r) => {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    const h = Array.isArray(r.price_alert_hits) ? r.price_alert_hits[0] : r.price_alert_hits;
    return {
      id: r.id, product_id: r.product_id, currency: r.currency, target_price: num(r.target_price), created_at: r.created_at,
      product_key: p?.product_key ?? null, display_name: p?.display_name ?? null, hit_at: h?.notified_at ?? null,
    };
  });
}

export async function deleteAlert(id: string): Promise<void> {
  const { error } = await supabase.from('price_alerts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
