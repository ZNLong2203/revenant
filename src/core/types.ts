/**
 * Shared vocabulary for Revenant. Everything in src/core is plain TypeScript
 * with no Next.js imports, so the web app, the CLI and the MCP server all run
 * the same engine.
 */

/** Where a document came from. Decides which extractor and patcher apply. */
export type DocumentFormat = "wikitext" | "markdown" | "html" | "text";

/**
 * The five states a cited link can be in. Each maps onto a value of
 * Wikipedia's CS1 `url-status` parameter, so a verdict can be written straight
 * back into a citation:
 *
 * - alive      -> live      the page is there and still says what was cited
 * - buried     -> dead      hard failure: 404/410, DNS gone, connection refused
 * - ghost      -> dead      soft 404: answers 200 but the content is gone
 * - possessed  -> usurped   the domain died and someone else now owns it
 *                 / unfit   (parked, gambling, spam), so the link is harmful
 * - changeling -> deviated  same site, but the cited content was replaced
 * - unknown                 we could not tell (bot wall, timeout, rate limit)
 */
export type Verdict =
  | "alive"
  | "buried"
  | "ghost"
  | "possessed"
  | "changeling"
  | "unknown";

export const VERDICTS: readonly Verdict[] = [
  "possessed",
  "changeling",
  "ghost",
  "buried",
  "unknown",
  "alive",
] as const;

/** CS1 `url-status` values Revenant writes. */
export type UrlStatus = "live" | "dead" | "usurped" | "unfit" | "deviated";

export type LinkKind =
  | "cite-template"
  | "bracket-link"
  | "bare-url"
  | "markdown-link"
  | "markdown-autolink"
  | "html-anchor";

/** Half-open character range [start, end) into the source document. */
export interface Span {
  start: number;
  end: number;
}

export interface ExtractedLink {
  /** Stable id: hash of url and source offset. */
  id: string;
  /** URL as written in the source. */
  rawUrl: string;
  /** Normalised URL used for network calls and caching. */
  url: string;
  kind: LinkKind;
  /** Location of the whole citation/link construct in the source. */
  span: Span;
  /** Location of the URL itself in the source. */
  urlSpan: Span;
  /** Link text or citation title, if any. */
  title?: string;
  /** The sentence or paragraph that cites this link, plain text. */
  context: string;
  /** ISO date (YYYY-MM-DD) the author says they read the page, if known. */
  accessDate?: string;
  /** Archive copy already recorded in the citation, if any. */
  existingArchive?: { url: string; date?: string };
  /** `url-status` already recorded in the citation, if any. */
  existingStatus?: string;
  /** Short quote the citation itself carries (`quote=`), if any. */
  quote?: string;
}

export interface SourceDocument {
  id: string;
  format: DocumentFormat;
  /** Human title: article name, repo path, page title. */
  title: string;
  /** Where the text came from, for display and for edit links. */
  origin: DocumentOrigin;
  text: string;
  links: ExtractedLink[];
  /** Links skipped because the scan limit was reached. */
  truncated: number;
}

export type DocumentOrigin =
  | { type: "wikipedia"; lang: string; title: string; revisionId?: number; url: string }
  | { type: "github"; repo: string; path: string; ref: string; url: string }
  | { type: "web"; url: string }
  | { type: "paste" };

/** One observation that pushed the verdict one way or the other. */
export interface Evidence {
  /** Machine id, e.g. "http-404", "rdap-reregistered", "parking-page". */
  signal: string;
  /** One plain sentence a person can read. */
  detail: string;
  /** Which verdict this evidence argues for. */
  points: Verdict;
  /** 0..1, how strongly. */
  weight: number;
}

export interface LiveObservation {
  ok: boolean;
  status?: number;
  finalUrl?: string;
  redirects: string[];
  title?: string;
  /** First ~4k chars of visible text. */
  text?: string;
  contentType?: string;
  error?: string;
  /** "dns" | "timeout" | "refused" | "tls" | "blocked" | "too-large" | "other" */
  errorKind?: string;
  fetchedAt: string;
}

export interface DomainObservation {
  domain: string;
  /** ISO timestamp of the current registration, from RDAP. */
  registeredAt?: string;
  rdapAvailable: boolean;
}

export interface Snapshot {
  /** 14-digit Wayback timestamp, e.g. 20140320152702. */
  timestamp: string;
  original: string;
  status: number;
  mimetype?: string;
  digest?: string;
}

export interface ArchiveObservation {
  snapshot?: Snapshot;
  /** Human-facing archive URL (with toolbar). */
  url?: string;
  title?: string;
  text?: string;
  /** How many 200 snapshots exist in the window we looked at. */
  candidates: number;
  /** Earliest snapshot we saw, ISO date. */
  firstSeen?: string;
}

export type ClaimSupport = "supported" | "partial" | "unsupported" | "unknown";

export interface ClaimCheck {
  /** Does the archived copy support the citing sentence? */
  archive: ClaimSupport;
  /** Does the live page still support it? (only checked for live pages) */
  live?: ClaimSupport;
  /** Short verbatim quote from the archived text that backs the claim. */
  quote?: string;
  rationale: string;
  method: "llm" | "lexical";
  model?: string;
}

export interface Remedy {
  action: "none" | "archive" | "manual";
  urlStatus?: UrlStatus;
  archiveUrl?: string;
  /** ISO date YYYY-MM-DD. */
  archiveDate?: string;
  note?: string;
}

export interface Examination {
  linkId: string;
  url: string;
  verdict: Verdict;
  /** 0..1 */
  confidence: number;
  /** One sentence for the UI headline. */
  summary: string;
  evidence: Evidence[];
  live?: LiveObservation;
  domain?: DomainObservation;
  archive?: ArchiveObservation;
  claim?: ClaimCheck;
  remedy: Remedy;
  examinedAt: string;
  durationMs: number;
}

/** Everything the examine step needs to know about one link. */
export interface ExamineRequest {
  linkId: string;
  url: string;
  context?: string;
  title?: string;
  accessDate?: string;
  quote?: string;
  existingArchive?: { url: string; date?: string };
}
