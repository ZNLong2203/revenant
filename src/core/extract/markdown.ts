/**
 * Markdown link extractor: inline links, reference definitions, autolinks and
 * bare URLs. Fenced code blocks and inline code are skipped, because URLs in
 * code samples are usually examples, not citations.
 */
import type { ExtractedLink, Span } from "../types";
import { collapseWhitespace } from "../text";
import { isArchiveUrl, normalizeUrl, shortHash } from "../url";
import { trimmedUrlLength } from "./wikitext";

/** Spans of fenced code blocks, indented code and inline code. */
export function codeSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1\2[`~]*[ \t]*$|(?![\s\S]))/gm)) {
    spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  for (const m of text.matchAll(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g)) {
    const s = m.index ?? 0;
    if (!spans.some((c) => s >= c.start && s < c.end)) spans.push({ start: s, end: s + m[0].length });
  }
  for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) {
    spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return spans;
}

function lineAround(text: string, start: number, end: number): string {
  // paragraph = text between blank lines
  const a = text.lastIndexOf("\n\n", start);
  const b = text.indexOf("\n\n", end);
  const para = text.slice(a === -1 ? 0 : a + 2, b === -1 ? text.length : b);
  return markdownToPlain(para).slice(0, 500);
}

export function markdownToPlain(s: string): string {
  return collapseWhitespace(
    s
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      .replace(/<(https?:[^>]+)>/g, "$1")
      .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+[.)]|>)\s+/gm, "")
      .replace(/[*_~`]+/g, "")
      .replace(/<[^>]+>/g, ""),
  );
}

export function extractMarkdown(text: string): ExtractedLink[] {
  const code = codeSpans(text);
  const inCode = (i: number) => code.some((c) => i >= c.start && i < c.end);
  const links: ExtractedLink[] = [];
  const taken: Span[] = [];
  const overlaps = (s: Span) => taken.some((t) => s.start < t.end && t.start < s.end);

  const push = (link: Omit<ExtractedLink, "id">) => {
    if (overlaps(link.span)) return;
    taken.push(link.span);
    links.push({ id: shortHash(`${link.url}@${link.span.start}`), ...link });
  };

  // [label](url "title")  and  ![alt](url)
  for (const m of text.matchAll(/(!?)\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\(\s*<?(https?:\/\/[^\s)>]+(?:\([^\s)]*\)[^\s)>]*)*)>?(?:\s+["'(][^)]*["')])?\s*\)/g)) {
    const start = m.index ?? 0;
    if (inCode(start)) continue;
    const rawUrl = m[3];
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    const urlStart = start + m[0].indexOf(rawUrl, m[1].length + m[2].length + 2);
    const span = { start, end: start + m[0].length };
    push({
      rawUrl,
      url,
      kind: "markdown-link",
      span,
      urlSpan: { start: urlStart, end: urlStart + rawUrl.length },
      title: markdownToPlain(m[2]) || undefined,
      context: lineAround(text, span.start, span.end),
    });
  }

  // [id]: https://example.com "Title"
  for (const m of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*<?(https?:\/\/[^\s>]+)>?/gm)) {
    const start = m.index ?? 0;
    if (inCode(start)) continue;
    const rawUrl = m[2];
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    const urlStart = start + m[0].indexOf(rawUrl);
    const label = m[1];
    // context: the paragraph that uses [label]
    const useAt = text.search(new RegExp(`\\[[^\\]]*\\]\\[${escapeRe(label)}\\]|\\[${escapeRe(label)}\\](?!:)`, "i"));
    push({
      rawUrl,
      url,
      kind: "markdown-link",
      span: { start, end: start + m[0].length },
      urlSpan: { start: urlStart, end: urlStart + rawUrl.length },
      title: label,
      context: useAt >= 0 ? lineAround(text, useAt, useAt + label.length) : label,
    });
  }

  // <https://example.com>
  for (const m of text.matchAll(/<(https?:\/\/[^\s>]+)>/g)) {
    const start = m.index ?? 0;
    if (inCode(start)) continue;
    const rawUrl = m[1];
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    push({
      rawUrl,
      url,
      kind: "markdown-autolink",
      span: { start, end: start + m[0].length },
      urlSpan: { start: start + 1, end: start + 1 + rawUrl.length },
      context: lineAround(text, start, start + m[0].length),
    });
  }

  // bare URLs (GFM autolink literals)
  for (const m of text.matchAll(/(?<![("'<\w/=\]])https?:\/\/[^\s<>"'`]+/g)) {
    const start = m.index ?? 0;
    if (inCode(start)) continue;
    const rawUrl = m[0].slice(0, trimmedUrlLength(m[0]));
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    push({
      rawUrl,
      url,
      kind: "bare-url",
      span: { start, end: start + rawUrl.length },
      urlSpan: { start, end: start + rawUrl.length },
      context: lineAround(text, start, start + rawUrl.length),
    });
  }

  return links.sort((a, b) => a.span.start - b.span.start);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
