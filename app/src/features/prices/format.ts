// Small formatting helpers shared by the price screens.
import { formatMoney } from '@/lib/receipts';

/** Whole days between an ISO date (YYYY-MM-DD) and today. */
export function daysAgo(isoDate: string | null | undefined): number {
  if (!isoDate) return 9999;
  const then = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
}

export type Freshness = 'fresh' | 'recent' | 'old';
export function freshness(days: number): Freshness {
  return days <= 7 ? 'fresh' : days <= 30 ? 'recent' : 'old';
}

/** "2 L", "500 g", "12 un" — or an empty string. */
export function sizeLabel(value: number | null | undefined, unit: string | null | undefined): string {
  if (!value || !unit) return '';
  const v = Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
  return `${v} ${unit === 'l' ? 'L' : unit}`;
}

/** "62,50 MZN/kg" — base unit derived from the printed unit. */
export function unitPriceLabel(unitPrice: number | null | undefined, unit: string | null | undefined, currency: string): string {
  if (unitPrice === null || unitPrice === undefined || !unit) return '';
  const base = unit === 'kg' || unit === 'g' ? 'kg' : unit === 'l' || unit === 'ml' ? 'L' : 'un';
  return `${formatMoney(unitPrice, currency)}/${base}`;
}

/** Big price: whole part bold, cents small. Returns the two parts. */
export function splitMoney(n: number): { whole: string; cents: string } {
  const s = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  return i > 0 ? { whole: s.slice(0, i), cents: s.slice(i) } : { whole: s, cents: '' };
}
