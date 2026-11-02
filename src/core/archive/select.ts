/**
 * Choosing which archived copy to resurrect. Pure, so it is property-tested.
 *
 * The rule that matters most: never pick a snapshot captured after the domain
 * changed hands. The Wayback Machine keeps crawling usurped domains, so the
 * newest copy of a possessed link is usually a copy of the squatter's page.
 */
import type { Snapshot } from "../types";
import { isoToTimestamp, timestampToMs } from "../url";

export interface SelectOptions {
  /** Prefer the copy closest to this ISO date (the citation's access date). */
  target?: string;
  /** Exclude copies captured on or after this ISO date (the takeover). */
  notAfter?: string;
}

const ACCEPTABLE_MIME = /^(text\/html|application\/xhtml|application\/pdf|text\/plain|warc\/revisit|unk)/i;

export function isUsable(s: Snapshot): boolean {
  return s.status === 200 && /^\d{14}$/.test(s.timestamp) && (!s.mimetype || ACCEPTABLE_MIME.test(s.mimetype));
}

/** Candidates in preference order (best first). */
export function rankSnapshots(snaps: Snapshot[], opts: SelectOptions = {}): Snapshot[] {
  const cutoff = opts.notAfter ? isoToTimestamp(opts.notAfter) : "";
  const eligible = snaps.filter((s) => isUsable(s) && (!cutoff || s.timestamp < cutoff));
  const targetMs = opts.target ? Date.parse(opts.target.length === 10 ? `${opts.target}T00:00:00Z` : opts.target) : NaN;
  const seen = new Set<string>();
  const unique = eligible.filter((s) => (seen.has(s.timestamp) ? false : (seen.add(s.timestamp), true)));
  if (Number.isNaN(targetMs)) {
    // no target: the latest good copy (before any takeover) is the best memory of the page
    return unique.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  }
  return unique.sort((a, b) => {
    const da = Math.abs(timestampToMs(a.timestamp) - targetMs);
    const db = Math.abs(timestampToMs(b.timestamp) - targetMs);
    // equal distance: the earlier copy wins (closer to what the author saw)
    return da - db || (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  });
}

export function selectSnapshot(snaps: Snapshot[], opts: SelectOptions = {}): Snapshot | undefined {
  return rankSnapshots(snaps, opts)[0];
}

/** Parse the CDX JSON output (first row is the header). */
export function parseCdx(rows: unknown): Snapshot[] {
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) return [];
  const header = rows[0] as string[];
  const col = (name: string) => header.indexOf(name);
  const iTs = col("timestamp");
  const iOrig = col("original");
  const iStatus = col("statuscode");
  const iMime = col("mimetype");
  const iDigest = col("digest");
  if (iTs === -1 || iOrig === -1) return [];
  const out: Snapshot[] = [];
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) continue;
    const status = Number(row[iStatus]);
    out.push({
      timestamp: String(row[iTs]),
      original: String(row[iOrig]),
      status: Number.isFinite(status) ? status : 0,
      mimetype: iMime >= 0 ? String(row[iMime]) : undefined,
      digest: iDigest >= 0 ? String(row[iDigest]) : undefined,
    });
  }
  return out;
}
