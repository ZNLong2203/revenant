/**
 * Citation dates come in many shapes: "2014-03-06", "6 March 2014",
 * "March 6, 2014", "March 2014", "2014". Turn them into ISO YYYY-MM-DD.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | undefined {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return dt.toISOString().slice(0, 10);
}

export function parseLooseDate(raw: string): string | undefined {
  const s = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\{\{[^}]*\}\}/g, "").trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m && monthOf(m[2])) return iso(+m[3], monthOf(m[2]), +m[1]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && monthOf(m[1])) return iso(+m[3], monthOf(m[1]), +m[2]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (m && monthOf(m[1])) return iso(+m[2], monthOf(m[1]), 1);
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], 1);
  m = s.match(/^(\d{4})$/);
  if (m) return iso(+m[1], 1, 1);
  return undefined;
}

function monthOf(name: string): number {
  const k = name.toLowerCase();
  return MONTHS[k.slice(0, 4)] ?? MONTHS[k.slice(0, 3)] ?? 0;
}

/** Days between two ISO dates/datetimes (b - a). */
export function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}
