/**
 * The public services Revenant consults: RDAP for domain registration dates
 * and the Wayback Machine's CDX index for archived copies.
 */
import { parseCdx, rankSnapshots, type SelectOptions } from "../archive/select";
import type { ArchiveObservation, DomainObservation, Snapshot } from "../types";
import { htmlTitle, htmlToText } from "../text";
import { isoToTimestamp, timestampToIsoDate, waybackRawUrl, waybackUrl } from "../url";
import { spamScore } from "../signals/lexicon";
import { cached } from "./cache";
import { safeFetch } from "./fetch";

const DAY = 86_400;

/** Current registration date of a domain, via the rdap.org bootstrap. */
export async function lookupDomain(domain: string): Promise<DomainObservation> {
  if (!domain) return { domain, rdapAvailable: false };
  return cached(`rdap:${domain}`, 7 * DAY, async () => {
    try {
      const r = await safeFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        trusted: true,
        timeoutMs: 8000,
        headers: { accept: "application/rdap+json, application/json" },
      });
      if (r.status !== 200) return { domain, rdapAvailable: false };
      const data = JSON.parse(r.body) as { events?: { eventAction?: string; eventDate?: string }[] };
      const reg = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
      return { domain, registeredAt: reg, rdapAvailable: true };
    } catch {
      return { domain, rdapAvailable: false };
    }
  });
}

/** Up to `limit` 200-status snapshots, closest to `target` first. */
export async function listSnapshots(url: string, target?: string, limit = 12): Promise<Snapshot[]> {
  const ts = target ? isoToTimestamp(target) : isoToTimestamp(new Date().toISOString());
  const key = `cdx:${url}:${ts.slice(0, 8)}`;
  return cached(key, 3 * DAY, async () => {
    const q = new URLSearchParams({
      url,
      output: "json",
      fl: "timestamp,original,statuscode,mimetype,digest",
      filter: "statuscode:200",
      closest: ts,
      sort: "closest",
      limit: String(limit),
    });
    try {
      const r = await safeFetch(`https://web.archive.org/cdx/search/cdx?${q}`, {
        trusted: true,
        timeoutMs: 20_000,
        headers: { accept: "application/json" },
      });
      if (r.status !== 200 || !r.body.trim()) return [];
      return parseCdx(JSON.parse(r.body));
    } catch {
      return [];
    }
  });
}

/** Earliest snapshot of a URL (any status), as an ISO date. */
export async function firstSeen(url: string): Promise<string | undefined> {
  return cached(`first:${url}`, 30 * DAY, async () => {
    const q = new URLSearchParams({ url, output: "json", fl: "timestamp", limit: "1" });
    try {
      const r = await safeFetch(`https://web.archive.org/cdx/search/cdx?${q}`, { trusted: true, timeoutMs: 15_000 });
      const rows = JSON.parse(r.body) as string[][];
      return rows[1]?.[0] ? timestampToIsoDate(rows[1][0]) : undefined;
    } catch {
      return undefined;
    }
  });
}

/** Raw bytes of one snapshot, reduced to title + visible text. */
export async function readSnapshot(s: Snapshot): Promise<{ title?: string; text: string } | undefined> {
  return cached(`snap:${s.timestamp}:${s.original}`, 30 * DAY, async () => {
    try {
      const r = await safeFetch(waybackRawUrl(s.timestamp, s.original), { trusted: true, timeoutMs: 20_000, maxBytes: 1_200_000 });
      if (r.status !== 200) return undefined;
      return { title: htmlTitle(r.body), text: htmlToText(r.body, 8000) };
    } catch {
      return undefined;
    }
  });
}

/**
 * Find the best archived copy: closest to the access date, never after a
 * takeover, and not itself a copy of a spam page (crawlers keep visiting
 * usurped domains). Tries up to three candidates.
 */
export async function findArchive(url: string, opts: SelectOptions & { firstSeenHint?: string } = {}): Promise<ArchiveObservation> {
  const target = opts.target ?? (opts.notAfter ? opts.notAfter : undefined);
  const snaps = await listSnapshots(url, target);
  const ranked = rankSnapshots(snaps, opts);
  const seenDates = snaps.map((s) => s.timestamp).sort();
  const first = opts.firstSeenHint ?? (seenDates[0] ? timestampToIsoDate(seenDates[0]) : undefined);
  for (const snap of ranked.slice(0, 3)) {
    const page = await readSnapshot(snap);
    if (!page) continue;
    const spam = spamScore(`${page.title ?? ""} ${page.text}`);
    if (spam.score >= 0.5) continue;
    return {
      snapshot: snap,
      url: waybackUrl(snap.timestamp, snap.original),
      title: page.title,
      text: page.text,
      candidates: ranked.length,
      firstSeen: first,
    };
  }
  return { candidates: ranked.length, firstSeen: first };
}
