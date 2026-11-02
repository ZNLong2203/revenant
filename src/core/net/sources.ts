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
  try {
    return await cached(`rdap:${domain}`, 7 * DAY, async () => {
      const r = await safeFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        trusted: true,
        timeoutMs: 8000,
        headers: { accept: "application/rdap+json, application/json" },
      });
      // 404: the registry has no record (unregistered, or a TLD without RDAP); that answer is stable
      if (r.status === 404) return { domain, rdapAvailable: false };
      if (r.status !== 200) throw new UpstreamBusy(`RDAP answered ${r.status}`);
      const data = JSON.parse(r.body) as { events?: { eventAction?: string; eventDate?: string }[] };
      const reg = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
      return { domain, registeredAt: reg, rdapAvailable: true };
    });
  } catch {
    return { domain, rdapAvailable: false };
  }
}

class UpstreamBusy extends Error {}

/**
 * GET a Wayback CDX query. Retries politely on 429/503 (honouring
 * Retry-After, capped) and throws on failure so callers never cache an
 * outage as "no snapshots".
 */
// Circuit breaker: after three CDX failures in a row, leave the archive alone
// for a minute. It is a shared public service, and a struggling archive should
// not also make every scan wait 20 s per link.
let cdxFailures = 0;
let cdxPausedUntil = 0;

export function cdxPaused(): boolean {
  return Date.now() < cdxPausedUntil;
}

async function cdx(query: URLSearchParams): Promise<string> {
  if (cdxPaused()) throw new UpstreamBusy("CDX paused after repeated failures");
  try {
    for (let attempt = 0; ; attempt++) {
      const r = await safeFetch(`https://web.archive.org/cdx/search/cdx?${query}`, {
        trusted: true,
        timeoutMs: 20_000,
        headers: { accept: "application/json" },
      });
      if (r.status === 200) {
        cdxFailures = 0;
        return r.body;
      }
      if ((r.status === 429 || r.status === 503) && attempt < 2) {
        const wait = Math.min(8, Number(r.headers.get("retry-after")) || 2 * (attempt + 1));
        await new Promise((res) => setTimeout(res, wait * 1000));
        continue;
      }
      throw new UpstreamBusy(`CDX answered ${r.status}`);
    }
  } catch (error) {
    if (++cdxFailures >= 3) {
      cdxPausedUntil = Date.now() + 60_000;
      cdxFailures = 0;
    }
    throw error;
  }
}

/** Up to `limit` 200-status snapshots, closest to `target` first. Empty on outage (not cached). */
export async function listSnapshots(url: string, target?: string, limit = 12): Promise<Snapshot[]> {
  const ts = target ? isoToTimestamp(target) : isoToTimestamp(new Date().toISOString());
  const key = `cdx:${url}:${ts.slice(0, 8)}`;
  try {
    return await cached(key, 3 * DAY, async () => {
      const body = await cdx(
        new URLSearchParams({
          url,
          output: "json",
          fl: "timestamp,original,statuscode,mimetype,digest",
          filter: "statuscode:200",
          closest: ts,
          sort: "closest",
          limit: String(limit),
        }),
      );
      return body.trim() ? parseCdx(JSON.parse(body)) : [];
    });
  } catch {
    return [];
  }
}

/** Earliest snapshot of a URL (any status), as an ISO date. */
export async function firstSeen(url: string): Promise<string | undefined> {
  try {
    return await cached(`first:${url}`, 30 * DAY, async () => {
      const body = await cdx(new URLSearchParams({ url, output: "json", fl: "timestamp", limit: "1" }));
      const rows = (body.trim() ? JSON.parse(body) : []) as string[][];
      return rows[1]?.[0] ? timestampToIsoDate(rows[1][0]) : "";
    });
  } catch {
    return undefined;
  }
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

  let spamUntil: string | undefined;
  const tryCandidates = async (list: Snapshot[]): Promise<ArchiveObservation | undefined> => {
    for (const snap of list) {
      const page = await readSnapshot(snap);
      if (!page) continue;
      if (spamScore(`${page.title ?? ""} ${page.text}`).score >= 0.5) {
        // the archive already holds the squatter's page here; remember the earliest such copy
        if (!spamUntil || snap.timestamp < spamUntil) spamUntil = snap.timestamp;
        continue;
      }
      return { snapshot: snap, url: waybackUrl(snap.timestamp, snap.original), title: page.title, text: page.text, candidates: ranked.length, firstSeen: first };
    }
    return undefined;
  };

  const found = await tryCandidates(ranked.slice(0, 3));
  if (found) return found;
  if (spamUntil) {
    // every nearby copy was spam: step three years back from the earliest spam copy and look again
    const back = new Date(Date.parse(`${timestampToIsoDate(spamUntil)}T00:00:00Z`) - 3 * 365 * 86_400_000).toISOString().slice(0, 10);
    const older = rankSnapshots(await listSnapshots(url, back), { target: back, notAfter: timestampToIsoDate(spamUntil) });
    const again = await tryCandidates(older.slice(0, 3));
    if (again) return again;
  }
  return { candidates: ranked.length, firstSeen: first };
}
