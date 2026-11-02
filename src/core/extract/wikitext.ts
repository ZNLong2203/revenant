/**
 * Wikitext citation parser. Finds {{cite ...}}/{{citation}} templates,
 * [http://url label] bracket links and bare URLs, and records exact source
 * spans so the patcher can rewrite one parameter without touching any other
 * byte of the article.
 */
import type { ExtractedLink, Span } from "../types";
import { collapseWhitespace, decodeEntities } from "../text";
import { isArchiveUrl, normalizeUrl, shortHash } from "../url";
import { parseLooseDate } from "../dates";

export interface TemplateParam {
  /** Parameter name, lower-cased and trimmed; null for positional params. */
  name: string | null;
  /** Raw value text (untrimmed). */
  value: string;
  /** The whole "|name = value" segment, starting at the pipe. */
  span: Span;
  /** Just the value, untrimmed. */
  valueSpan: Span;
}

export interface ParsedTemplate {
  name: string;
  span: Span;
  params: TemplateParam[];
}

/**
 * Index of the "}}" that closes the template opened at `open` ("{{"), or -1.
 * Handles nested {{ }}, [[ ]] and {{{ }}} parameters.
 */
export function findTemplateEnd(text: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    if (text.startsWith("{{", i)) {
      depth++;
      i += 2;
    } else if (text.startsWith("}}", i)) {
      depth--;
      i += 2;
      if (depth === 0) return i;
    } else if (text.startsWith("<!--", i)) {
      const close = text.indexOf("-->", i + 4);
      i = close === -1 ? text.length : close + 3;
    } else {
      i++;
    }
  }
  return -1;
}

/** Split a template body into top-level "|" segments with offsets. */
export function parseTemplate(text: string, span: Span): ParsedTemplate {
  const inner = { start: span.start + 2, end: span.end - 2 };
  const cuts: number[] = [];
  let braces = 0;
  let squares = 0;
  for (let i = inner.start; i < inner.end; i++) {
    if (text.startsWith("{{", i)) {
      braces++;
      i++;
    } else if (text.startsWith("}}", i)) {
      braces--;
      i++;
    } else if (text.startsWith("[[", i)) {
      squares++;
      i++;
    } else if (text.startsWith("]]", i)) {
      squares--;
      i++;
    } else if (text.startsWith("<!--", i)) {
      const close = text.indexOf("-->", i + 4);
      i = close === -1 ? inner.end : close + 2;
    } else if (text[i] === "|" && braces === 0 && squares === 0) {
      cuts.push(i);
    }
  }
  const nameEnd = cuts.length ? cuts[0] : inner.end;
  const name = collapseWhitespace(text.slice(inner.start, nameEnd)).toLowerCase();
  const params: TemplateParam[] = [];
  for (let k = 0; k < cuts.length; k++) {
    const segStart = cuts[k];
    const segEnd = k + 1 < cuts.length ? cuts[k + 1] : inner.end;
    const body = text.slice(segStart + 1, segEnd);
    const eq = topLevelEquals(body);
    if (eq === -1) {
      params.push({ name: null, value: body, span: { start: segStart, end: segEnd }, valueSpan: { start: segStart + 1, end: segEnd } });
    } else {
      params.push({
        name: body.slice(0, eq).trim().toLowerCase(),
        value: body.slice(eq + 1),
        span: { start: segStart, end: segEnd },
        valueSpan: { start: segStart + 1 + eq + 1, end: segEnd },
      });
    }
  }
  return { name, span, params };
}

function topLevelEquals(body: string): number {
  let braces = 0;
  let squares = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith("{{", i)) { braces++; i++; }
    else if (body.startsWith("}}", i)) { braces--; i++; }
    else if (body.startsWith("[[", i)) { squares++; i++; }
    else if (body.startsWith("]]", i)) { squares--; i++; }
    else if (body[i] === "=" && braces === 0 && squares === 0) return i;
  }
  return -1;
}

/** Every top-level and nested template in the text, outermost first. */
export function findTemplates(text: string): ParsedTemplate[] {
  const out: ParsedTemplate[] = [];
  let i = 0;
  while ((i = text.indexOf("{{", i)) !== -1) {
    if (text.startsWith("{{{", i)) {
      i += 3;
      continue;
    }
    const end = findTemplateEnd(text, i);
    if (end === -1) break;
    out.push(parseTemplate(text, { start: i, end }));
    i += 2; // step inside so nested templates are found too
  }
  return out;
}

const CITE_NAME = /^(cite[ _]|cite$|citation$|vcite|vancite)/;

export function isCiteTemplate(t: ParsedTemplate): boolean {
  return CITE_NAME.test(t.name);
}

export function param(t: ParsedTemplate, ...names: string[]): TemplateParam | undefined {
  for (const n of names) {
    const p = t.params.find((x) => x.name === n);
    if (p && p.value.trim()) return p;
  }
  return undefined;
}

/** Turn a fragment of wikitext into readable plain text. */
export function wikiToPlain(s: string): string {
  let out = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>/]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  // drop templates (iteratively, innermost first)
  for (let k = 0; k < 6 && /\{\{[^{}]*\}\}/.test(out); k++) out = out.replace(/\{\{[^{}]*\}\}/g, "");
  out = out
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^[*#:;=]+|=+$/gm, "");
  return collapseWhitespace(decodeEntities(out));
}

/**
 * The claim a reference supports: the plain text of the sentence that ends
 * right before the <ref> tag at `refStart`.
 */
export function claimBefore(text: string, refStart: number): string {
  // walk back past earlier adjacent refs: "claim.<ref>a</ref><ref>b</ref>"
  let end = refStart;
  for (;;) {
    const before = text.slice(Math.max(0, end - 2000), end);
    const m = before.match(/<ref[^>]*>[\s\S]*?<\/ref>\s*$|<ref[^>]*\/>\s*$/i);
    if (!m) break;
    end -= m[0].length;
  }
  const windowStart = Math.max(0, end - 1500);
  let chunk = text.slice(windowStart, end);
  const para = chunk.lastIndexOf("\n\n");
  if (para !== -1) chunk = chunk.slice(para + 2);
  const lineStart = chunk.lastIndexOf("\n");
  if (lineStart !== -1 && chunk.length - lineStart > 40) chunk = chunk.slice(lineStart + 1);
  const plain = wikiToPlain(chunk);
  // keep the last sentence (and the one before it if the last is very short)
  const sentences = plain.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  let claim = sentences.pop() ?? "";
  if (claim.length < 60 && sentences.length) claim = `${sentences.pop()} ${claim}`;
  return claim.slice(-500).trim();
}

interface RefContext {
  span: Span;
  claim: string;
}

/** Map every <ref>...</ref> body to the claim text in front of it. */
function refContexts(text: string): RefContext[] {
  const out: RefContext[] = [];
  const re = /<ref(?:\s[^>]*)?>([\s\S]*?)<\/ref>/gi;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    out.push({ span: { start, end: start + m[0].length }, claim: claimBefore(text, start) });
  }
  return out;
}

function within(span: Span, outer: Span): boolean {
  return span.start >= outer.start && span.end <= outer.end;
}

/** Extract every checkable external link from an article's wikitext. */
export function extractWikitext(text: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const refs = refContexts(text);
  const templates = findTemplates(text);
  const covered: Span[] = [];

  const claimFor = (span: Span, fallback: string) =>
    refs.find((r) => within(span, r.span))?.claim || fallback;

  for (const t of templates) {
    // remember every template span so bracket/bare URL passes skip their insides
    covered.push(t.span);
    if (!isCiteTemplate(t)) continue;
    const urlParam = param(t, "url");
    if (!urlParam) continue;
    const rawUrl = urlParam.value.trim();
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    const lead = urlParam.value.length - urlParam.value.trimStart().length;
    const urlSpan = { start: urlParam.valueSpan.start + lead, end: urlParam.valueSpan.start + lead + rawUrl.length };
    const title = param(t, "title", "script-title", "trans-title", "chapter", "work", "website", "publisher");
    const access = param(t, "access-date", "accessdate");
    const archiveUrl = param(t, "archive-url", "archiveurl");
    const archiveDate = param(t, "archive-date", "archivedate");
    const status = param(t, "url-status", "dead-url", "deadurl");
    const quote = param(t, "quote");
    const titleText = title ? wikiToPlain(title.value) : undefined;
    links.push({
      id: shortHash(`${url}@${t.span.start}`),
      rawUrl,
      url,
      kind: "cite-template",
      span: t.span,
      urlSpan,
      title: titleText,
      context: claimFor(t.span, titleText ?? ""),
      accessDate: access ? parseLooseDate(access.value) : undefined,
      existingArchive: archiveUrl
        ? { url: archiveUrl.value.trim(), date: archiveDate ? parseLooseDate(archiveDate.value) : undefined }
        : undefined,
      existingStatus: status ? normaliseStatus(status.name, status.value) : undefined,
      quote: quote ? wikiToPlain(quote.value) : undefined,
    });
  }

  const inTemplate = (s: Span) => covered.some((c) => s.start >= c.start && s.end <= c.end);

  // [http://example.com/page Label]
  for (const m of text.matchAll(/\[(https?:\/\/[^\s\]<>{}|]+)(?:\s+([^\]\n]*))?\]/gi)) {
    const start = m.index ?? 0;
    const span = { start, end: start + m[0].length };
    if (inTemplate(span)) continue;
    const rawUrl = m[1];
    const url = normalizeUrl(rawUrl);
    if (!url || isArchiveUrl(url)) continue;
    covered.push(span);
    const label = m[2] ? wikiToPlain(m[2]) : undefined;
    links.push({
      id: shortHash(`${url}@${start}`),
      rawUrl,
      url,
      kind: "bracket-link",
      span,
      urlSpan: { start: start + 1, end: start + 1 + rawUrl.length },
      title: label,
      context: claimFor(span, label ?? wikiToPlain(text.slice(Math.max(0, start - 300), start)).slice(-300)),
    });
  }

  // bare URLs in running text
  for (const m of text.matchAll(/(?<![=\[|/\w])https?:\/\/[^\s\]<>{}|"]+/gi)) {
    const start = m.index ?? 0;
    const span = { start, end: start + m[0].length };
    if (inTemplate(span) || covered.some((c) => start >= c.start && start < c.end)) continue;
    const url = normalizeUrl(m[0]);
    if (!url || isArchiveUrl(url)) continue;
    const rawUrl = m[0].slice(0, trimmedUrlLength(m[0]));
    links.push({
      id: shortHash(`${url}@${start}`),
      rawUrl,
      url,
      kind: "bare-url",
      span: { start, end: start + rawUrl.length },
      urlSpan: { start, end: start + rawUrl.length },
      context: claimFor(span, wikiToPlain(text.slice(Math.max(0, start - 300), start)).slice(-300)),
    });
  }

  return links.sort((a, b) => a.span.start - b.span.start);
}

/**
 * Length of a bare URL once trailing sentence punctuation is dropped, keeping
 * closing parens that balance an opener inside the URL. Keeps patch spans exact.
 */
export function trimmedUrlLength(raw: string): number {
  const stripped = raw.replace(/[)\].,;:!?'"»”’]+$/u, "");
  const opens = (stripped.match(/\(/g) ?? []).length - (stripped.match(/\)/g) ?? []).length;
  let len = stripped.length;
  let extra = opens;
  while (extra > 0 && raw[len] === ")") {
    len++;
    extra--;
  }
  return len;
}

function normaliseStatus(name: string | null, value: string): string {
  const v = value.trim().toLowerCase();
  if (name === "dead-url" || name === "deadurl") return v === "no" ? "live" : v === "usurped" ? "usurped" : "dead";
  return v;
}
