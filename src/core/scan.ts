/**
 * Whole-document scan for the CLI and MCP server (the web app drives the
 * same steps from the browser so results can stream in one by one).
 */
import { mapPool } from "./net/limiter";
import { applyFixes, planFix, type PatchResult, type PlannedFix } from "./patch";
import { examineLink } from "./server";
import { emptyCounts, uniqueTargets } from "./group";
import type { Examination, ExtractedLink, SourceDocument, Verdict } from "./types";

export { emptyCounts, uniqueTargets };

export interface ScanResult {
  doc: SourceDocument;
  /** One examination per link id (links sharing a URL share the result). */
  results: Record<string, Examination>;
  counts: Record<Verdict, number>;
}

export async function scanDocument(
  doc: SourceDocument,
  opts: { concurrency?: number; maxLinks?: number; onResult?: (link: ExtractedLink, ex: Examination) => void } = {},
): Promise<ScanResult> {
  const links = opts.maxLinks ? doc.links.slice(0, opts.maxLinks) : doc.links;
  const results: Record<string, Examination> = {};
  const counts = emptyCounts();
  await mapPool(uniqueTargets(links), opts.concurrency ?? 4, async (group) => {
    const lead = group[0];
    const ex = await examineLink({
      linkId: lead.id,
      url: lead.url,
      title: lead.title,
      context: lead.context,
      accessDate: lead.accessDate,
      quote: lead.quote,
      existingArchive: lead.existingArchive,
    });
    for (const l of group) {
      results[l.id] = { ...ex, linkId: l.id };
      counts[ex.verdict]++;
      opts.onResult?.(l, ex);
    }
  });
  return { doc: { ...doc, links }, results, counts };
}

export function takeoverDateOf(ex: Examination): string | undefined {
  return ex.evidence.some((e) => e.signal === "rdap-reregistered") ? ex.domain?.registeredAt?.slice(0, 10) : undefined;
}

export function planFixes(scan: ScanResult): PlannedFix[] {
  const out: PlannedFix[] = [];
  for (const link of scan.doc.links) {
    const ex = scan.results[link.id];
    if (!ex) continue;
    const fix = planFix(link, ex, takeoverDateOf(ex));
    if (fix) out.push(fix);
  }
  return out;
}

export function patchScan(scan: ScanResult, fileName?: string): PatchResult {
  return applyFixes(scan.doc.text, planFixes(scan), scan.doc.format, fileName ?? scan.doc.title.replace(/[^\w.-]+/g, "_"));
}
