/**
 * Examine one link end to end: look at the live page, the domain's
 * registration and the archive, decide, verify the claim against the copy we
 * would resurrect, and propose a remedy. Server-only (does network I/O).
 *
 * Network calls are injected so tests can run the whole pipeline offline.
 */
import type { ArchiveObservation, ClaimCheck, DomainObservation, Examination, ExamineRequest, LiveObservation } from "./types";
import { decide, remedyFor, reregisteredAfter, type Observations } from "./signals/verdict";
import { isParkingHost, parkingHits, soft404Hits, spamScore } from "./signals/lexicon";
import { coverage } from "./text";
import { crossedDomains, isRootRedirect, isStableResolver, registrableDomain } from "./url";
import type { SelectOptions } from "./archive/select";

export interface ExamineDeps {
  live: (url: string) => Promise<LiveObservation>;
  domain: (domain: string) => Promise<DomainObservation>;
  archive: (url: string, opts: SelectOptions) => Promise<ArchiveObservation>;
  firstSeen: (url: string) => Promise<string | undefined>;
  claim: (input: {
    claim: string;
    title?: string;
    url: string;
    accessDate?: string;
    archiveText?: string;
    liveText?: string;
    quote?: string;
  }) => Promise<ClaimCheck>;
  now?: () => Date;
}

const YEAR_MS = 365 * 86_400_000;

/** Build a made-up sibling URL that should not exist on the same host. */
export function siblingUrl(url: string, seed = Math.random().toString(36).slice(2, 10)): string {
  const u = new URL(url);
  const ext = u.pathname.match(/\.(html?|php|aspx?|jsp)$/i)?.[0] ?? "";
  const dir = u.pathname.replace(/[^/]*$/, "");
  return `${u.origin}${dir}revenant-${seed}${ext}`;
}

export async function examine(req: ExamineRequest, deps: ExamineDeps): Promise<Examination> {
  const started = Date.now();
  const now = deps.now?.() ?? new Date();

  if (isStableResolver(req.url)) {
    return {
      linkId: req.linkId,
      url: req.url,
      verdict: "alive",
      confidence: 0.5,
      summary: "Alive: stable resolver (DOI, Wikipedia, library catalogue); not probed.",
      evidence: [{ signal: "stable-resolver", points: "alive", weight: 0.5, detail: "Persistent identifiers redirect to the current home of the work." }],
      remedy: { action: "none" },
      examinedAt: now.toISOString(),
      durationMs: 0,
    };
  }

  const domainName = registrableDomain(req.url);
  const [live, domain] = await Promise.all([
    deps.live(req.url),
    domainName ? deps.domain(domainName) : Promise.resolve<DomainObservation | undefined>(undefined),
  ]);

  // ---- decide how much more to look at ------------------------------------
  const liveText = `${live.title ?? ""} ${live.text ?? ""}`;
  const final = live.finalUrl ?? req.url;
  const recentRegistration = domain?.registeredAt ? now.getTime() - Date.parse(domain.registeredAt) < 6 * YEAR_MS : false;
  const suspicious =
    !live.ok ||
    isParkingHost(final) ||
    parkingHits(liveText).length > 0 ||
    spamScore(liveText).score > 0 ||
    soft404Hits(live.title, live.text).length > 0 ||
    isRootRedirect(req.url, final) ||
    crossedDomains(req.url, final) ||
    reregisteredAfter(domain, req.accessDate) ||
    (!req.accessDate && recentRegistration) ||
    (req.title ? coverage(req.title, liveText) < 0.5 : false);

  let first: string | undefined;
  if (!req.accessDate && recentRegistration) first = await deps.firstSeen(req.url);
  const since = req.accessDate ?? first;
  const takeover = reregisteredAfter(domain, since) ? domain?.registeredAt?.slice(0, 10) : undefined;

  const wantSibling = live.ok && !isRootRedirect(req.url, final) && new URL(req.url).pathname.length > 1 && (suspicious || !req.title);
  const [archive, sibling] = await Promise.all([
    suspicious || req.existingArchive
      ? deps.archive(req.url, { target: req.accessDate ?? takeover, notAfter: takeover })
      : Promise.resolve<ArchiveObservation | undefined>(undefined),
    wantSibling ? deps.live(siblingUrl(req.url)) : Promise.resolve<LiveObservation | undefined>(undefined),
  ]);
  if (archive && !archive.firstSeen && first) archive.firstSeen = first;

  const obs: Observations = {
    url: req.url,
    title: req.title,
    context: req.context,
    accessDate: req.accessDate,
    live,
    domain,
    archive,
    sibling,
  };
  let decision = decide(obs);

  // ---- verify the copy we would resurrect against the citing sentence -----
  let claim: ClaimCheck | undefined;
  const claimText = req.context || req.title || "";
  if (claimText && archive?.text && (decision.verdict !== "alive" || decision.evidence.some((e) => e.points === "changeling"))) {
    claim = await deps.claim({
      claim: claimText,
      title: req.title,
      url: req.url,
      accessDate: req.accessDate,
      archiveText: archive.text,
      liveText: live.ok && decision.verdict !== "possessed" ? live.text : undefined,
      quote: req.quote,
    });
    decision = decide({ ...obs, claim });
  }

  const remedy = remedyFor(decision, archive);
  if (remedy.action === "archive" && claim?.archive === "unsupported") {
    remedy.note = `${remedy.note ? `${remedy.note} ` : ""}The archived copy does not clearly support the cited sentence; review before saving.`;
  }

  return {
    linkId: req.linkId,
    url: req.url,
    verdict: decision.verdict,
    confidence: decision.confidence,
    summary: decision.summary,
    evidence: decision.evidence,
    live: { ...live, text: live.text?.slice(0, 1500) },
    domain,
    archive: archive ? { ...archive, text: archive.text?.slice(0, 1500) } : undefined,
    claim,
    remedy,
    examinedAt: now.toISOString(),
    durationMs: Date.now() - started,
  };
}
