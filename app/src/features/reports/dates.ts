// Date helpers for reports. All dates are local-time 'YYYY-MM-DD' strings, months are 'YYYY-MM'.
import { t } from '@/lib/i18n';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 'YYYY-MM' of a date, shifted by `offset` months. */
export function ym(d: Date, offset = 0): string {
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

export function ymShift(yearMonth: string, offset: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return ym(new Date(y, m - 1, 1), offset);
}

/** First day of a month as 'YYYY-MM-DD'. */
export function monthStart(yearMonth: string): string {
  return `${yearMonth}-01`;
}

/** First day of the following month (exclusive upper bound). */
export function monthEnd(yearMonth: string): string {
  return monthStart(ymShift(yearMonth, 1));
}

/** The last N months ending with the current one, oldest first. */
export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(ym(now, -i));
  return out;
}

export function daysLeftInMonth(now = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, last - now.getDate() + 1);
}

/** 'Aug' / 'Ago' — translated short month name from 'YYYY-MM'. */
export function monthShort(yearMonth: string): string {
  const m = Number(yearMonth.slice(5, 7));
  return t(MONTHS_EN[m - 1] ?? '?');
}

/** 'August 2026' / 'agosto de 2026'. */
export function monthLong(yearMonth: string, lang: 'en' | 'pt'): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { month: 'long', year: 'numeric' });
}

/** '28 Aug' style short date from 'YYYY-MM-DD'. */
export function dayShort(isoDate: string): string {
  const d = parseIso(isoDate);
  return `${d.getDate()} ${monthShort(ym(d))}`;
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}
