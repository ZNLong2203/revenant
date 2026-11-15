/**
 * Turn examinations into a patched document and a reviewable diff.
 * Runs in the browser too: the web app builds the patch client-side.
 */
import { createTwoFilesPatch } from "diff";
import { parseTemplate, param } from "../extract/wikitext";
import type { DocumentFormat, Examination, ExtractedLink, Remedy, Verdict } from "../types";
import { applyEdits, formatDateLike, setTemplateParams, type TextEdit } from "./wikitext";

export { applyEdits, setTemplateParams, formatDateLike };

export interface PlannedFix {
  link: ExtractedLink;
  verdict: Verdict;
  remedy: Remedy;
}

export interface PatchResult {
  text: string;
  diff: string;
  applied: { linkId: string; url: string; verdict: Verdict; change: string }[];
  skipped: { linkId: string; url: string; reason: string }[];
}

/** Which verdicts get rewritten. Alive and unknown are left to people. */
export const FIXABLE: Verdict[] = ["possessed", "ghost", "buried", "changeling"];

/**
 * Decide what to write for one link. If the citation already carries an
 * archive copy taken before the takeover, keep it and only fix url-status.
 */
export function planFix(link: ExtractedLink, exam: Examination, takeoverDate?: string): PlannedFix | undefined {
  if (!FIXABLE.includes(exam.verdict)) return undefined;
  const remedy = { ...exam.remedy };
  const existing = link.existingArchive;
  const existingIsClean = existing?.url && (!takeoverDate || !existing.date || existing.date < takeoverDate);
  if (existingIsClean && link.kind === "cite-template") {
    remedy.archiveUrl = existing.url;
    remedy.archiveDate = existing.date;
    remedy.action = "archive";
  }
  const warnOnly = link.kind === "cite-template" && (remedy.urlStatus === "usurped" || remedy.urlStatus === "unfit");
  if (remedy.action !== "archive" && !warnOnly) return undefined;
  return { link, verdict: exam.verdict, remedy };
}

/**
 * The CS1 parameters a fix writes into a citation template. Shared by the
 * patcher and by the census worklist, so both show exactly the same change.
 */
export function citeUpdates(text: string, fix: PlannedFix): Record<string, string> {
  const { link, remedy } = fix;
  const updates: Record<string, string> = {};
  if (remedy.archiveUrl && remedy.archiveDate) {
    const example = param(parseTemplate(text, link.span), "access-date", "accessdate", "date")?.value;
    updates["archive-url"] = remedy.archiveUrl;
    updates["archive-date"] = formatDateLike(remedy.archiveDate, example);
  }
  if (remedy.urlStatus && (remedy.archiveUrl || remedy.urlStatus === "usurped" || remedy.urlStatus === "unfit")) {
    // CS1 only honours url-status when archive-url is present; usurped/unfit still warn editors
    updates["url-status"] = remedy.urlStatus;
  }
  return updates;
}
function editsFor(text: string, fix: PlannedFix): { edits: TextEdit[]; change: string } | { reason: string } {
  const { link, remedy } = fix;
  const archiveUrl = remedy.archiveUrl;
  switch (link.kind) {
    case "cite-template": {
      const updates = citeUpdates(text, fix);
      const edits = setTemplateParams(text, link.span, updates);
      return { edits, change: describe(updates) };
    }
    case "bracket-link":
    case "bare-url": {
      if (!archiveUrl || !remedy.archiveDate) return { reason: "no archived copy to point at" };
      if (fix.verdict === "possessed") {
        // never leave readers one click from a squatter: swap the URL itself
        return { edits: [{ ...link.urlSpan, replacement: archiveUrl }], change: `URL replaced with archive copy (${remedy.archiveDate})` };
      }
      const tag = ` {{webarchive |url=${archiveUrl} |date=${remedy.archiveDate}}}`;
      return { edits: [{ start: link.span.end, end: link.span.end, replacement: tag }], change: `{{webarchive}} added (${remedy.archiveDate})` };
    }
    default: {
      if (!archiveUrl) return { reason: "no archived copy to point at" };
      return { edits: [{ ...link.urlSpan, replacement: archiveUrl }], change: `URL replaced with archive copy (${remedy.archiveDate ?? "archived"})` };
    }
  }
}

function describe(updates: Record<string, string>): string {
  return Object.entries(updates)
    .map(([k, v]) => `${k}=${k === "archive-url" ? "…" : v}`)
    .join(", ");
}

export function applyFixes(text: string, fixes: PlannedFix[], format: DocumentFormat, fileName = "document"): PatchResult {
  const edits: TextEdit[] = [];
  const applied: PatchResult["applied"] = [];
  const skipped: PatchResult["skipped"] = [];
  const taken: { start: number; end: number }[] = [];

  for (const fix of [...fixes].sort((a, b) => a.link.span.start - b.link.span.start)) {
    const r = editsFor(text, fix);
    if ("reason" in r) {
      skipped.push({ linkId: fix.link.id, url: fix.link.url, reason: r.reason });
      continue;
    }
    if (r.edits.length === 0) {
      skipped.push({ linkId: fix.link.id, url: fix.link.url, reason: "already up to date" });
      continue;
    }
    const clash = r.edits.some((e) => taken.some((t) => e.start < t.end && t.start < e.end || (e.start === e.end && e.start > t.start && e.start < t.end)));
    if (clash) {
      skipped.push({ linkId: fix.link.id, url: fix.link.url, reason: "overlaps another fix" });
      continue;
    }
    edits.push(...r.edits);
    taken.push(...r.edits.map((e) => ({ start: e.start, end: Math.max(e.end, e.start) })));
    applied.push({ linkId: fix.link.id, url: fix.link.url, verdict: fix.verdict, change: r.change });
  }

  const patched = applyEdits(text, edits);
  const ext = format === "wikitext" ? ".wiki" : format === "markdown" ? ".md" : format === "html" ? ".html" : ".txt";
  const name = fileName.endsWith(ext) || /\.[a-z]+$/i.test(fileName) ? fileName : `${fileName}${ext}`;
  const diff = createTwoFilesPatch(`a/${name}`, `b/${name}`, text, patched, undefined, undefined, { context: 2 });
  return { text: patched, diff, applied, skipped };
}
