/**
 * Text helpers: HTML to visible text, tokenising, and similarity.
 * Pure and dependency-free so they run anywhere.
 */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body.toLowerCase()] ?? m;
  });
}

export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** <title> of an HTML document, decoded and collapsed. */
export function htmlTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const t = collapseWhitespace(decodeEntities(m[1].replace(/<[^>]+>/g, "")));
  return t || undefined;
}

/** Visible text of an HTML document (scripts, styles and markup removed). */
export function htmlToText(html: string, limit = 20000): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return collapseWhitespace(decodeEntities(stripped)).slice(0, limit);
}

/** Meta description or og:description, if present. */
export function htmlDescription(html: string): string | undefined {
  const m =
    html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:og:)?description["']/i);
  return m ? collapseWhitespace(decodeEntities(m[1])) || undefined : undefined;
}

const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have in is it its of on or that the this to was were will with " +
    "not no we you he she they them his her their our your i me my us do does did so than then there these those " +
    "which who whom what when where why how all any can could should would may might must also more most other " +
    "some such only own same very just into over under about after before between through during out up down off " +
    "again further once here both each few nor too s t don now"
  ).split(" "),
);

/** Lower-case word tokens, unicode-aware, stopwords removed, length >= 2. */
export function tokens(s: string): string[] {
  const out: string[] = [];
  for (const m of s.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const w = m[0];
    if (w.length >= 2 && !STOPWORDS.has(w)) out.push(w);
  }
  return out;
}

/**
 * Jaccard similarity of token sets, in [0, 1].
 * Symmetric; identical non-empty inputs give 1; two empty inputs give 1.
 */
export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Share of `needle`'s distinct tokens that appear in `haystack`, in [0, 1].
 * Used for "does this page still mention what was cited?".
 */
export function coverage(needle: string, haystack: string): number {
  const N = new Set(tokens(needle));
  if (N.size === 0) return 0;
  const H = new Set(tokens(haystack));
  let hit = 0;
  for (const t of N) if (H.has(t)) hit++;
  return hit / N.size;
}

/** Cut a string to `max` chars on a word boundary, adding an ellipsis. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/**
 * Find the sentence-ish window around [start, end) in plain text: back to the
 * previous sentence end or newline, forward to the next. Max ~400 chars.
 */
export function sentenceAround(text: string, start: number, end: number, max = 400): string {
  let a = start;
  while (a > 0 && start - a < max && !/[.!?\n]/.test(text[a - 1])) a--;
  let b = end;
  while (b < text.length && b - end < max && !/[.!?\n]/.test(text[b])) b++;
  if (b < text.length && /[.!?]/.test(text[b])) b++;
  return collapseWhitespace(text.slice(a, b));
}
