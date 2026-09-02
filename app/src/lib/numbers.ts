/** Parse what a person types: "12.5", "12,5", "1.384,20", "1,384.20" all work. Returns null if not a number. */
export function parseNumber(s: string): number | null {
  let v = s.replace(/\s/g, '');
  if (!v) return null;
  const lastDot = v.lastIndexOf('.');
  const lastComma = v.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) v = lastComma > lastDot ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  else v = v.replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
