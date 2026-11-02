/**
 * HTML anchor extractor for "scan this web page". Only outbound links (to a
 * different registrable domain) are kept: they are the ones that rot out of
 * the author's control.
 */
import type { ExtractedLink } from "../types";
import { collapseWhitespace, decodeEntities, htmlToText } from "../text";
import { isArchiveUrl, normalizeUrl, registrableDomain, shortHash } from "../url";

export function extractHtml(html: string, baseUrl?: string): ExtractedLink[] {
  const base = baseUrl ? registrableDomain(baseUrl) : "";
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const start = m.index ?? 0;
    const rawHref = decodeEntities(m[2]);
    let absolute: string;
    try {
      absolute = baseUrl ? new URL(rawHref, baseUrl).toString() : rawHref;
    } catch {
      continue;
    }
    const url = normalizeUrl(absolute);
    if (!url || isArchiveUrl(url)) continue;
    if (base && registrableDomain(url) === base) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const hrefAt = start + m[0].indexOf(m[2]);
    const before = html.slice(Math.max(0, start - 1200), start);
    const after = html.slice(start + m[0].length, start + m[0].length + 400);
    const context = collapseWhitespace(
      `${htmlToText(before).slice(-320)} ${htmlToText(m[3])} ${htmlToText(after).slice(0, 160)}`,
    );
    links.push({
      id: shortHash(`${url}@${start}`),
      rawUrl: m[2],
      url,
      kind: "html-anchor",
      span: { start, end: start + m[0].length },
      urlSpan: { start: hrefAt, end: hrefAt + m[2].length },
      title: htmlToText(m[3]) || undefined,
      context,
    });
  }
  return links;
}
