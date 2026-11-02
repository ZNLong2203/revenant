/**
 * The decision procedure. Pure: given what we observed about a link, return a
 * verdict, a confidence and the evidence behind it. All network access lives
 * elsewhere, which is what lets the property tests hammer this file.
 */
import type {
  ArchiveObservation,
  ClaimCheck,
  DomainObservation,
  Evidence,
  LiveObservation,
  Remedy,
  UrlStatus,
  Verdict,
} from "../types";
import { coverage, jaccard } from "../text";
import { crossedDomains, isRootRedirect, timestampToIsoDate, waybackUrl } from "../url";
import { isParkingHost, parkingHits, soft404Hits, spamScore } from "./lexicon";

export interface Observations {
  url: string;
  title?: string;
  context?: string;
  accessDate?: string;
  live: LiveObservation;
  domain?: DomainObservation;
  archive?: ArchiveObservation;
  /** Response to a made-up sibling URL on the same host (soft-404 probe). */
  sibling?: LiveObservation;
  claim?: ClaimCheck;
}

export interface Decision {
  verdict: Verdict;
  confidence: number;
  evidence: Evidence[];
  summary: string;
  /** When the domain changed hands, if we could tell. ISO date. */
  takeoverDate?: string;
}

/** Severity order, used to break ties. */
const SEVERITY: Verdict[] = ["possessed", "ghost", "changeling", "buried", "unknown", "alive"];

/** Days of slack before a re-registration counts (registrar renewals, transfers). */
const REREG_GRACE_DAYS = 45;

/** Has the domain been registered after `since` (ISO date)? */
export function reregisteredAfter(domain: DomainObservation | undefined, since: string | undefined): boolean {
  if (!domain?.registeredAt || !since) return false;
  const reg = Date.parse(domain.registeredAt);
  const ref = Date.parse(since.length === 10 ? `${since}T00:00:00Z` : since);
  if (Number.isNaN(reg) || Number.isNaN(ref)) return false;
  return reg - ref > REREG_GRACE_DAYS * 86_400_000;
}

/** Noisy-OR: independent pieces of evidence for the same verdict add up. */
function combine(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - Math.max(0, Math.min(1, w))), 1);
}

export function decide(o: Observations): Decision {
  const ev: Evidence[] = [];
  const add = (signal: string, points: Verdict, weight: number, detail: string) =>
    ev.push({ signal, points, weight, detail });

  const live = o.live;
  const since = o.accessDate ?? o.archive?.firstSeen;
  const rereg = reregisteredAfter(o.domain, since);
  const takeoverDate = rereg ? o.domain?.registeredAt?.slice(0, 10) : undefined;

  // ---- hard failures -------------------------------------------------------
  if (!live.ok) {
    switch (live.errorKind) {
      case "dns":
        add("dns-gone", "buried", 0.92, "The domain no longer resolves to any server.");
        break;
      case "refused":
        add("connection-refused", "buried", 0.75, "The server refuses connections.");
        break;
      case "tls":
        add("tls-broken", "buried", 0.55, "The site's HTTPS certificate is broken or expired.");
        break;
      case "timeout":
        add("timeout", "unknown", 0.5, "The server did not answer in time.");
        break;
      case "blocked":
        add("ssrf-blocked", "unknown", 0.9, "The address points at a private network, so Revenant will not visit it.");
        break;
      default:
        if (live.status === 404 || live.status === 410) {
          add(`http-${live.status}`, "buried", 0.96, `The server answers ${live.status} ${live.status === 410 ? "Gone" : "Not Found"}.`);
        } else if (live.status && [401, 403, 405, 406, 429, 451, 999].includes(live.status)) {
          add(`http-${live.status}`, "unknown", 0.6, `The site turned away an automated visitor (HTTP ${live.status}), so a person should check it.`);
        } else if (live.status && live.status >= 500) {
          add(`http-${live.status}`, "buried", 0.5, `The server is failing (HTTP ${live.status}). It may be temporary.`);
        } else if (live.status && live.status >= 400) {
          add(`http-${live.status}`, "buried", 0.7, `The server answers HTTP ${live.status}.`);
        } else {
          add("fetch-failed", "unknown", 0.5, live.error ? `The page could not be fetched: ${live.error}.` : "The page could not be fetched.");
        }
    }
    if (rereg && live.errorKind !== "dns") {
      add("rdap-reregistered", "possessed", 0.35, `The domain was registered again on ${takeoverDate}, after it was cited.`);
    }
    return finish(ev, o, takeoverDate);
  }

  // ---- the page answered ---------------------------------------------------
  const finalUrl = live.finalUrl ?? o.url;
  const liveText = `${live.title ?? ""} ${live.text ?? ""}`;
  const archiveText = `${o.archive?.title ?? ""} ${o.archive?.text ?? ""}`;
  const hasArchive = Boolean(o.archive?.snapshot && (o.archive.text || o.archive.title));

  // parked / for sale
  if (isParkingHost(finalUrl)) {
    add("parking-host", "possessed", 0.93, `The link now redirects to ${new URL(finalUrl).hostname}, a domain marketplace.`);
  }
  const parking = parkingHits(liveText);
  if (parking.length >= 2) {
    add("parking-page", "possessed", 0.9, `The page reads like a parked domain ("${parking[0]}").`);
  } else if (parking.length === 1) {
    add("parking-page", "possessed", 0.45, `The page mentions "${parking[0]}", which parked domains show.`);
  }

  // spam takeover
  const liveSpam = spamScore(liveText);
  const archiveSpam = hasArchive ? spamScore(archiveText) : { score: 0, hits: [] as string[] };
  const spamJump = liveSpam.score - archiveSpam.score;
  if (liveSpam.score >= 0.5 && spamJump >= 0.34) {
    add(
      "spam-takeover",
      "possessed",
      0.6 + 0.35 * spamJump,
      `The page is now full of ${describeSpam(liveSpam.hits)} terms ("${liveSpam.hits.slice(0, 3).join('", "')}")${hasArchive ? " that the archived copy never used" : ""}.`,
    );
  } else if (liveSpam.score >= 0.34 && spamJump > 0) {
    add("spam-terms", "possessed", 0.3, `The page uses spam terms ("${liveSpam.hits.slice(0, 2).join('", "')}").`);
  }

  // domain re-registration
  const similarity = hasArchive ? jaccard(liveText, archiveText) : undefined;
  if (rereg) {
    const weight = similarity !== undefined && similarity < 0.12 ? 0.8 : similarity !== undefined && similarity > 0.4 ? 0.2 : 0.55;
    add(
      "rdap-reregistered",
      "possessed",
      weight,
      `The domain's current registration began on ${takeoverDate}, after the citation${o.accessDate ? ` was accessed (${o.accessDate})` : " was first archived"}. Someone new owns it.`,
    );
  }

  // left for another site
  if (crossedDomains(o.url, finalUrl) && !isParkingHost(finalUrl)) {
    add("cross-domain-redirect", "changeling", 0.25, `The link now redirects to a different site, ${safeHost(finalUrl)}.`);
  }

  // soft 404
  const s404 = soft404Hits(live.title, live.text);
  const titleS404 = soft404Hits(live.title, "");
  if (titleS404.length) {
    add("soft-404-title", "ghost", 0.88, `The page answers 200 OK but its title says "${live.title}".`);
  } else if (s404.some((p) => p.length > 12)) {
    add("soft-404-text", "ghost", 0.6, `The page answers 200 OK but says "${s404.find((p) => p.length > 12)}".`);
  }
  if (isRootRedirect(o.url, finalUrl) && !crossedDomains(o.url, finalUrl)) {
    add("redirect-to-home", "ghost", 0.75, "The deep link now quietly redirects to the site's home page.");
  }
  if (o.sibling?.ok && o.sibling.status === 200 && live.text && o.sibling.text) {
    const same = jaccard(live.text, o.sibling.text);
    if (same >= 0.9) {
      add(
        "sibling-probe",
        "ghost",
        0.8,
        `A made-up address on the same site returns the same page (${Math.round(same * 100)}% identical), so this URL no longer has content of its own.`,
      );
    }
  }

  // content drift
  if (hasArchive && similarity !== undefined) {
    const citedTitle = o.title ?? "";
    const titleNow = citedTitle ? coverage(citedTitle, liveText) : undefined;
    const titleThen = citedTitle ? coverage(citedTitle, archiveText) : undefined;
    if (similarity < 0.1 && titleNow !== undefined && titleThen !== undefined && titleNow < 0.34 && titleThen >= 0.6) {
      add(
        "content-replaced",
        "changeling",
        0.6,
        `The archived page matched the cited title, the live page does not (${Math.round(similarity * 100)}% overlap with the archived copy).`,
      );
    } else if (similarity < 0.05 && !rereg) {
      add("content-diverged", "changeling", 0.3, "The live page shares almost nothing with the archived copy.");
    }
  }
  if (o.claim?.live === "unsupported" && (o.claim.archive === "supported" || o.claim.archive === "partial")) {
    add("claim-drift", "changeling", 0.85, "The archived copy supports the cited sentence; the live page no longer does.");
  }

  // healthy signals
  if (o.title && coverage(o.title, liveText) >= 0.6) {
    add("title-present", "alive", 0.6, "The live page still carries the cited title.");
  }
  if (o.claim?.live === "supported") add("claim-live", "alive", 0.7, "The live page still supports the cited sentence.");
  if (!ev.some((e) => e.points !== "alive")) add("http-ok", "alive", 0.55, `The page answers ${live.status ?? 200} OK.`);

  return finish(ev, o, takeoverDate);
}

function finish(ev: Evidence[], o: Observations, takeoverDate?: string): Decision {
  const scores = new Map<Verdict, number>();
  for (const v of SEVERITY) {
    const w = ev.filter((e) => e.points === v).map((e) => e.weight);
    if (w.length) scores.set(v, combine(w));
  }
  let verdict: Verdict = o.live.ok ? "alive" : "unknown";
  let best = 0;
  for (const v of SEVERITY) {
    const s = scores.get(v) ?? 0;
    // alive must beat the others outright; problems win ties
    if (s > best + (v === "alive" ? 0.15 : 0)) {
      best = s;
      verdict = v;
    }
  }
  // problems below the bar fall back to alive (page answered) or unknown
  if (verdict !== "alive" && best < 0.5) {
    if (o.live.ok) {
      verdict = "alive";
      best = Math.max(0.5, scores.get("alive") ?? 0.5);
    } else if (verdict !== "buried") {
      verdict = "unknown";
    }
  }
  if (!o.live.ok && verdict === "alive") verdict = "unknown";
  const confidence = Math.round(Math.max(0, Math.min(1, best || 0.5)) * 100) / 100;
  return { verdict, confidence, evidence: ev.sort((a, b) => b.weight - a.weight), summary: summarise(verdict, ev, o), takeoverDate };
}

function summarise(v: Verdict, ev: Evidence[], o: Observations): string {
  const top = ev.find((e) => e.points === v);
  switch (v) {
    case "possessed":
      return `Possessed: ${top?.detail ?? "the domain now belongs to someone else."}`;
    case "ghost":
      return `Ghost: ${top?.detail ?? "the page answers, but nothing is there."}`;
    case "changeling":
      return `Changeling: ${top?.detail ?? "the page was replaced with different content."}`;
    case "buried":
      return `Buried: ${top?.detail ?? "the page is gone."}`;
    case "unknown":
      return `Unknown: ${top?.detail ?? "Revenant could not reach a verdict."}`;
    default:
      return o.live.status ? `Alive: the page answers ${o.live.status} and still looks like what was cited.` : "Alive.";
  }
}

function describeSpam(hits: string[]): string {
  const gambling = ["casino", "slot", "judi", "togel", "toto", "bandar", "poker", "bet", "jackpot", "gacor", "maxwin", "sbobet", "situs", "scatter"];
  return hits.some((h) => gambling.some((g) => h.includes(g))) ? "online-gambling" : "spam";
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Turn a decision into the fix Revenant proposes. Wikipedia's CS1 vocabulary
 * is the target, so a remedy can be written into a {{cite}} as-is.
 */
export function remedyFor(d: Decision, archive?: ArchiveObservation): Remedy {
  const snap = archive?.snapshot;
  const withArchive = (urlStatus: UrlStatus, note?: string): Remedy =>
    snap
      ? {
          action: "archive",
          urlStatus,
          archiveUrl: waybackUrl(snap.timestamp, snap.original),
          archiveDate: timestampToIsoDate(snap.timestamp),
          note,
        }
      : {
          action: "manual",
          urlStatus,
          note: "No usable archived copy exists. The citation needs a new source.",
        };

  switch (d.verdict) {
    case "possessed": {
      const usurped = d.evidence.some((e) => e.signal === "rdap-reregistered" && e.weight >= 0.5) || d.evidence.some((e) => e.signal.startsWith("parking"));
      return withArchive(usurped ? "usurped" : "unfit", "Hide the original link: it now leads to someone else's site.");
    }
    case "ghost":
    case "buried":
      return withArchive("dead");
    case "changeling":
      return withArchive("deviated", "The page still exists but no longer says what was cited.");
    case "unknown":
      return { action: "manual", note: "Check this link by hand." };
    default:
      return { action: "none", urlStatus: "live" };
  }
}
