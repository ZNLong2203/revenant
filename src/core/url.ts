/**
 * URL helpers. Pure functions, safe in the browser and on the server.
 */

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref_src|igshid)$/i;

/**
 * Normalise a URL for comparison and caching.
 * - lower-cases scheme and host, drops default ports and the fragment
 * - removes common tracking parameters
 * - keeps path and remaining query exactly (servers may be case-sensitive)
 * Returns null for anything that is not an absolute http(s) URL.
 *
 * Idempotent: normalizeUrl(normalizeUrl(x)) === normalizeUrl(x).
 */
export function normalizeUrl(raw: string): string | null {
  // Iterate one normalisation step to a fixpoint. Serialising can expose new
  // trailing punctuation ("http://a.com?!#" -> "http://a.com/?!"), so a single
  // pass is not idempotent (found by property test 17). Each step only ever
  // shortens or canonicalises, so this converges in a couple of rounds.
  let current: string | null = normalizeOnce(raw);
  for (let i = 0; i < 6 && current; i++) {
    const next = normalizeOnce(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function normalizeOnce(raw: string): string | null {
  const trimmed = raw.trim().replace(/[)\].,;:!?'"»”’]+$/u, (tail) => balanceTail(raw.trim(), tail));
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname || !u.hostname.includes(".")) return null;
  u.hash = "";
  // an empty query ("http://a.com/?") serialises with a dangling "?", which
  // the trailing-punctuation rule would strip on a second pass; drop it now
  // so normalisation is idempotent (found by property test 17)
  if (u.search === "") u.search = "";
  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
    u.port = "";
  }
  const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
  if (keep.length !== [...u.searchParams.keys()].length) {
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
  }
  return u.toString();
}

/**
 * Trailing punctuation is usually sentence punctuation, but a closing paren
 * can belong to the URL (Wikipedia links like /wiki/Foo_(bar)). Keep closers
 * that have a matching opener inside the URL.
 */
function balanceTail(url: string, tail: string): string {
  const body = url.slice(0, url.length - tail.length);
  let kept = "";
  let opens = (body.match(/\(/g) ?? []).length - (body.match(/\)/g) ?? []).length;
  let squares = (body.match(/\[/g) ?? []).length - (body.match(/\]/g) ?? []).length;
  for (const ch of tail) {
    if (ch === ")" && opens > 0) {
      kept += ch;
      opens--;
    } else if (ch === "]" && squares > 0) {
      kept += ch;
      squares--;
    } else {
      break;
    }
  }
  return kept;
}

/** Host without a leading "www.". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Second-level labels that act as public suffixes under a ccTLD
// (example.co.uk, example.com.au). Not the full Public Suffix List, but it
// covers the registrable domains RDAP can answer for.
const SECOND_LEVEL = new Set([
  "co", "com", "net", "org", "gov", "edu", "ac", "or", "ne", "go", "mil", "nic", "ltd", "plc", "sch", "nhs", "police", "gob", "gouv",
]);

/**
 * Best-effort registrable domain ("eTLD+1"): news.bbc.co.uk -> bbc.co.uk.
 * Returns "" for IP literals and single-label hosts.
 */
export function registrableDomain(url: string): string {
  const host = hostOf(url);
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return "";
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return "";
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  if (labels.length >= 3 && tld.length === 2 && SECOND_LEVEL.has(second)) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

/** True when a redirect landed on the site root from a deeper path. */
export function isRootRedirect(original: string, final: string): boolean {
  try {
    const a = new URL(original);
    const b = new URL(final);
    const deep = a.pathname.replace(/\/+$/, "").length > 0 || a.search.length > 0;
    const root = b.pathname === "/" || b.pathname === "" || /^\/(index\.(html?|php|aspx?))?$/i.test(b.pathname);
    return deep && root && !b.search;
  } catch {
    return false;
  }
}

/** The domain the user ends up on differs from the one cited. */
export function crossedDomains(original: string, final: string): boolean {
  const a = registrableDomain(original);
  const b = registrableDomain(final);
  return Boolean(a && b && a !== b);
}

/** Is this URL already an archive copy (no point probing it)? */
export function isArchiveUrl(url: string): boolean {
  const host = hostOf(url);
  return (
    host === "web.archive.org" ||
    host === "archive.org" ||
    host === "wayback.archive-it.org" ||
    host === "archive.today" ||
    host === "archive.ph" ||
    host === "archive.is" ||
    host === "webcitation.org" ||
    host === "perma.cc" ||
    host === "ghostarchive.org"
  );
}

/** Wikipedia's own links and DOIs resolve through stable resolvers. */
export function isStableResolver(url: string): boolean {
  const host = hostOf(url);
  return (
    host === "doi.org" ||
    host === "dx.doi.org" ||
    host === "hdl.handle.net" ||
    host === "arxiv.org" ||
    host === "pubmed.ncbi.nlm.nih.gov" ||
    host === "www.ncbi.nlm.nih.gov" ||
    host.endsWith("wikipedia.org") ||
    host.endsWith("wikimedia.org") ||
    host.endsWith("wikidata.org") ||
    host === "books.google.com" ||
    host === "worldcat.org" ||
    host === "search.worldcat.org" ||
    host === "jstor.org" ||
    host === "www.jstor.org" ||
    host === "isbnsearch.org"
  );
}

/** Wayback timestamp (14 digits) -> ISO date YYYY-MM-DD. */
export function timestampToIsoDate(ts: string): string {
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

/** ISO date or datetime -> 14-digit Wayback timestamp (UTC). */
export function isoToTimestamp(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** Wayback timestamp -> epoch ms. */
export function timestampToMs(ts: string): number {
  const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10) || "00"}:${ts.slice(10, 12) || "00"}:${ts.slice(12, 14) || "00"}Z`;
  return Date.parse(iso);
}

/** Human-facing Wayback URL (with toolbar). */
export function waybackUrl(timestamp: string, original: string): string {
  return `https://web.archive.org/web/${timestamp}/${stripDefaultPort(original)}`;
}

/** CDX records keep ":80" in `original`; readers don't need it. */
export function stripDefaultPort(url: string): string {
  return url.replace(/^(http:\/\/[^/:]+):80(?=\/|$)/i, "$1").replace(/^(https:\/\/[^/:]+):443(?=\/|$)/i, "$1");
}

/** Raw Wayback URL (original bytes, no toolbar or rewriting). */
export function waybackRawUrl(timestamp: string, original: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${original}`;
}

/** Short, stable, non-cryptographic hash (FNV-1a, base36). */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
