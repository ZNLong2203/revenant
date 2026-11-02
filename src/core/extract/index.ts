import type { DocumentFormat, ExtractedLink } from "../types";
import { sentenceAround } from "../text";
import { isArchiveUrl, normalizeUrl, shortHash } from "../url";
import { extractHtml } from "./html";
import { extractMarkdown } from "./markdown";
import { extractWikitext, trimmedUrlLength } from "./wikitext";

export { extractHtml, extractMarkdown, extractWikitext };

/** Guess the format of pasted text. */
export function detectFormat(text: string): DocumentFormat {
  const sample = text.slice(0, 20000);
  if (/\{\{\s*(cite|citation)\b/i.test(sample) || /<ref[\s>]/i.test(sample) || /\[\[[^\]]+\]\]/.test(sample)) {
    return "wikitext";
  }
  if (/<(html|body|a\s+href|p|div)\b/i.test(sample)) return "html";
  if (/\[[^\]]+\]\(https?:\/\//.test(sample) || /^#{1,6}\s/m.test(sample) || /^\s*[-*]\s+\[/m.test(sample)) {
    return "markdown";
  }
  return "text";
}

export function extractText(text: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
    const start = m.index ?? 0;
    const rawUrl = m[0].slice(0, trimmedUrlLength(m[0]));
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    const span = { start, end: start + rawUrl.length };
    links.push({
      id: shortHash(`${url}@${start}`),
      rawUrl,
      url,
      kind: "bare-url",
      span,
      urlSpan: span,
      context: sentenceAround(text, span.start, span.end),
    });
  }
  return links;
}

export function extractLinks(text: string, format: DocumentFormat, baseUrl?: string): ExtractedLink[] {
  switch (format) {
    case "wikitext":
      return extractWikitext(text);
    case "markdown":
      return extractMarkdown(text);
    case "html":
      return extractHtml(text, baseUrl);
    default:
      return extractText(text);
  }
}
