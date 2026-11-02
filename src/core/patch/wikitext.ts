/**
 * Rewrite parameters inside a {{cite ...}} template while leaving every other
 * byte alone: spacing, parameter order, comments and the template's own
 * formatting style are all preserved.
 */
import { parseTemplate, type ParsedTemplate } from "../extract/wikitext";
import type { Span } from "../types";

export interface TextEdit extends Span {
  replacement: string;
}

const ALIASES: Record<string, string[]> = {
  "archive-url": ["archive-url", "archiveurl"],
  "archive-date": ["archive-date", "archivedate"],
  "url-status": ["url-status", "dead-url", "deadurl"],
};

interface Style {
  /** Text placed before the "|" of a new parameter. */
  before: string;
  /** Text between "|" and the parameter name. */
  afterPipe: string;
  /** "=" with its surrounding spaces. */
  eq: string;
}

function detectStyle(text: string, t: ParsedTemplate): Style {
  const named = t.params.filter((p) => p.name);
  const sample = named.find((p) => p.name === "url") ?? named[0];
  const seg = sample ? text.slice(sample.span.start, sample.span.end) : "|";
  const m = seg.match(/^\|(\s*)[^=]*?(\s*)=(\s*)/);
  const afterPipe = m ? m[1].replace(/\n/g, "") : "";
  const eq = m ? `${m[2].replace(/\n/g, "")}=${m[3].replace(/\n/g, "")}` : "=";
  // what precedes the pipes after the first one?
  const preceding = t.params.slice(1).map((p) => text.slice(Math.max(t.span.start, p.span.start - 4), p.span.start));
  const multiline = preceding.length > 0 && preceding.filter((s) => s.includes("\n")).length >= preceding.length / 2;
  if (multiline) {
    const last = t.params[t.params.length - 1];
    const lineStart = text.lastIndexOf("\n", last.span.start);
    const indent = text.slice(lineStart + 1, last.span.start).match(/^[ \t]*/)?.[0] ?? "";
    return { before: `\n${indent}`, afterPipe, eq };
  }
  const spaced = preceding.length > 0 && preceding.filter((s) => /\s$/.test(s)).length >= preceding.length / 2;
  return { before: spaced ? " " : "", afterPipe, eq };
}

/**
 * Build edits that set `updates` on the template at `span` in `text`.
 * Existing parameters (or their legacy aliases) are rewritten in place;
 * missing ones are appended after the last parameter, matching the template's
 * style. Setting a parameter to the value it already has produces no edit.
 */
export function setTemplateParams(text: string, span: Span, updates: Record<string, string>): TextEdit[] {
  const t = parseTemplate(text, span);
  const style = detectStyle(text, t);
  const edits: TextEdit[] = [];
  const appended: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const names = ALIASES[key] ?? [key];
    const existing = t.params.find((p) => p.name && names.includes(p.name));
    if (existing) {
      const raw = existing.value;
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      const current = raw.trim();
      if (existing.name === key) {
        if (current === value) continue;
        edits.push({
          start: existing.valueSpan.start + lead,
          end: existing.valueSpan.end - trail,
          replacement: value,
        });
      } else {
        // legacy alias (dead-url=yes): rewrite the whole segment to the modern name
        const seg = text.slice(existing.span.start, existing.span.end);
        const trailing = seg.slice(seg.trimEnd().length);
        edits.push({
          start: existing.span.start,
          end: existing.span.end,
          replacement: `|${style.afterPipe}${key}${style.eq}${value}${trailing}`,
        });
      }
    } else {
      appended.push(`${style.before}|${style.afterPipe}${key}${style.eq}${value}`);
    }
  }

  if (appended.length) {
    // insert after the last parameter's trimmed value, before trailing space and "}}"
    const closeAt = span.end - 2;
    let at = closeAt;
    while (at > span.start + 2 && /\s/.test(text[at - 1])) at--;
    edits.push({ start: at, end: at, replacement: appended.join("") });
  }
  return edits;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

/**
 * Format an ISO date the way an example date in the same citation is
 * written, so the patch matches the article's date style.
 */
export function formatDateLike(iso: string, example?: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!example) return iso;
  const ex = example.trim();
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(ex)) return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
  if (/^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(ex)) return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(ex)) return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
  if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(ex)) return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
  return iso;
}

/** Apply non-overlapping edits. Throws if edits overlap. */
export function applyEdits(text: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) throw new Error("overlapping edits");
  }
  let out = "";
  let cursor = 0;
  for (const e of sorted) {
    out += text.slice(cursor, e.start) + e.replacement;
    cursor = e.end;
  }
  return out + text.slice(cursor);
}
