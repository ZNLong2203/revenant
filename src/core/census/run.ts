/**
 * The census engine: walk a list of articles, examine every distinct URL once,
 * and turn the findings into worklist rows (spec: .kiro/specs/graveyard-census).
 *
 * Browser-safe. Loading and examining are injected, so the same loop runs in
 * the CLI (direct calls), the browser (calls to /api) and in tests (stubs).
 */
import { citeUpdates, planFix, type PlannedFix } from "../patch";
import { emptyCounts } from "../group";
import type { Evidence, Examination, ExamineRequest, ExtractedLink, SourceDocument } from "../types";
import { shortHash } from "../url";
import { REVENANT_VERSION } from "../version";
import { REPORTED, type CensusRow, type CensusRun, type CensusSource } from "./types";

/** Thrown by a dependency to stop the run without losing progress (rate limit, offline). */
export class CensusPaused extends Error {}

export interface CensusProgress {
  /** Title being examined. */
  article: string;
  /** 1-based position of the article. */
  index: number;
  total: number;
  /** New URLs to examine in this article, and how many are finished. */
  urls: number;
  examined: number;
}

export interface CensusDeps {
  load: (title: string) => Promise<SourceDocument>;
  examine: (req: ExamineRequest) => Promise<Examination>;
  /** Called after each finished article. The run object is the one being updated. */
  save?: (run: CensusRun) => void | Promise<void>;
  onProgress?: (p: CensusProgress) => void;
  /** URLs examined at once within one article. Default 4. */
  concurrency?: number;
  /** Examine at most this many links per article. */
  maxLinks?: number;
  /** Give up on one URL after this long and count it as unknown, so one stuck request cannot hold the census. Default 120 000. */
  examineTimeoutMs?: number;
  signal?: AbortSignal;
  now?: () => Date;
}

export interface CensusOutcome {
  stop: "finished" | "aborted" | "paused";
  reason?: string;
}

export function createRun(
  source: CensusSource,
  articles: string[],
  opts: { moreArticles?: boolean; now?: Date; version?: string } = {},
): CensusRun {
  const created = (opts.now ?? new Date()).toISOString();
  const slug = source.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || source.kind;
  return {
    id: `${slug}-${created.slice(0, 10).replace(/-/g, "")}-${shortHash(`${source.kind}:${source.lang}:${source.value}:${created}`)}`,
    createdAt: created,
    version: opts.version ?? REVENANT_VERSION,
    source,
    articles,
    moreArticles: opts.moreArticles ?? false,
    done: 0,
    seenUrls: [],
    citations: 0,
    notChecked: 0,
    counts: emptyCounts(),
    findings: {},
    rows: [],
    errors: [],
  };
}

const oneLine = (s: string, max = 400) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/**
 * Wikitext leftovers: a citation inside an infobox or a {{Reflist}} has no
 * sentence of its own, and the extractor then hands back the template text
 * around it ("| released =", "References {{Reflist|refs").
 */
const MARKUP = /\{\{|\}\}|\[\[|\]\]|<\/?[a-z]+[ >/]|^\s*[|!*#=]|\|\s*[\w -]{1,40}\s*=/i;

/** The sentence a person should see for a citation, or the cited page's title when there is no real sentence. */
export function claimOf(link: Pick<ExtractedLink, "context" | "title">): string {
  const sentence = oneLine(link.context ?? "");
  if (sentence && !MARKUP.test(sentence)) return sentence;
  return link.title ? `Cited page: “${oneLine(link.title, 200)}”` : "";
}

/** The `url-status` values that mean an editor already handled this verdict. */
const HANDLED: Record<string, string[]> = { possessed: ["usurped", "unfit"], ghost: ["dead"], changeling: ["deviated"] };

/**
 * One line per independent signal that points to the verdict. Signals of one
 * family (parking-host and parking-page, spam-terms and spam-redirect) look at
 * the same cause, so only the strongest of a family counts.
 */
export function supportingEvidence(ex: Pick<Examination, "verdict" | "evidence">): string[] {
  const best = new Map<string, Evidence>();
  for (const e of ex.evidence) {
    if (e.points !== ex.verdict || e.weight <= 0) continue;
    const family = e.signal.split("-")[0];
    const cur = best.get(family);
    if (!cur || e.weight > cur.weight) best.set(family, e);
  }
  return [...best.values()]
    .sort((a, b) => b.weight - a.weight || (a.signal < b.signal ? -1 : 1))
    .map((e) => oneLine(e.detail));
}

function takeoverDate(ex: Examination): string | undefined {
  return ex.evidence.some((e) => e.signal === "rdap-reregistered") ? ex.domain?.registeredAt?.slice(0, 10) : undefined;
}

/** What to write into the citation, as the person on the worklist will read it. */
function describeFix(text: string, fix: PlannedFix): string | undefined {
  const { link, remedy } = fix;
  if (link.kind === "cite-template") {
    const updates = citeUpdates(text, fix);
    return Object.keys(updates).length ? Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(" | ") : undefined;
  }
  if (!remedy.archiveUrl) return undefined;
  if (link.kind === "bracket-link" || link.kind === "bare-url") {
    if (fix.verdict === "possessed") return `replace the URL with ${remedy.archiveUrl}`;
    return `{{webarchive |url=${remedy.archiveUrl} |date=${remedy.archiveDate ?? ""}}}`;
  }
  return `replace the URL with ${remedy.archiveUrl}`;
}

export function buildRow(link: ExtractedLink, ex: Examination, doc: Pick<SourceDocument, "title" | "text">): CensusRow {
  const fix = planFix(link, ex, takeoverDate(ex));
  const archiveUrl = fix?.remedy.archiveUrl ?? ex.remedy.archiveUrl;
  const fixText = fix ? describeFix(doc.text, fix) : undefined;
  return {
    article: doc.title,
    claim: claimOf(link),
    url: link.url,
    verdict: ex.verdict,
    confidence: ex.confidence,
    tagged: HANDLED[ex.verdict]?.includes(link.existingStatus ?? "") ?? false,
    evidence: supportingEvidence(ex),
    ...(fixText ? { fix: oneLine(fixText, 1200) } : {}),
    // Requirement 4.1: a copy that was checked against the sentence, or a person has to find a new source
    needsNewSource: !archiveUrl || !ex.claim || ex.claim.archive === "unsupported",
  };
}

/** Keep what a later citation of the same URL needs; drop page text. */
function slim(ex: Examination): Examination {
  return {
    ...ex,
    live: undefined,
    archive: ex.archive ? { ...ex.archive, text: undefined, title: undefined } : undefined,
  };
}

function unknownExamination(link: ExtractedLink, error: unknown, now: Date): Examination {
  const message = error instanceof Error ? error.message : "the examination failed";
  return {
    linkId: link.id,
    url: link.url,
    verdict: "unknown",
    confidence: 0,
    summary: `Unknown: ${message}.`,
    evidence: [],
    remedy: { action: "manual", note: "Check this link by hand." },
    examinedAt: now.toISOString(),
    durationMs: 0,
  };
}

/** Resolve with `promise`, or reject with an error after `ms`. */
function within<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(n, 1), items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

/**
 * Run (or resume) a census. Updates `run` in place and calls `deps.save` after
 * every finished article, so a stopped run continues from `run.done`.
 *
 * An article is committed all at once: if the run stops in the middle of one,
 * nothing from it is recorded and the next run starts it again.
 */
export async function runCensus(run: CensusRun, deps: CensusDeps): Promise<CensusOutcome> {
  const seen = new Set(run.seenUrls);
  // one citing sentence cited twice is one row, not two
  const rowKeys = new Set(run.rows.map((r) => `${r.article}\n${r.url}\n${r.claim}`));
  const now = () => deps.now?.() ?? new Date();
  while (run.done < run.articles.length) {
    if (deps.signal?.aborted) return { stop: "aborted" };
    const title = run.articles[run.done];
    const progress = { article: title, index: run.done + 1, total: run.articles.length, urls: 0, examined: 0 };
    deps.onProgress?.(progress);

    let doc: SourceDocument | undefined;
    try {
      doc = await deps.load(title);
    } catch (error) {
      if (error instanceof CensusPaused) return deps.signal?.aborted ? { stop: "aborted" } : { stop: "paused", reason: error.message };
      run.errors.push({ article: title, message: error instanceof Error ? error.message : "could not load the article" });
    }

    if (doc) {
      const links = deps.maxLinks ? doc.links.slice(0, deps.maxLinks) : doc.links;
      // the first citation of each new URL speaks for it: its access date picks the archive copy
      const fresh = new Map<string, ExtractedLink>();
      for (const l of links) if (!seen.has(l.url) && !fresh.has(l.url)) fresh.set(l.url, l);
      progress.urls = fresh.size;
      deps.onProgress?.({ ...progress });

      const results = new Map<string, Examination>();
      let paused: CensusPaused | undefined;
      await pool([...fresh.values()], deps.concurrency ?? 4, async (link) => {
        if (paused || deps.signal?.aborted) return;
        try {
          results.set(
            link.url,
            await within(
              deps.examine({
                linkId: link.id,
                url: link.url,
                title: link.title,
                context: link.context?.slice(0, 2000),
                accessDate: link.accessDate,
                quote: link.quote?.slice(0, 2000),
                existingArchive: link.existingArchive,
              }),
              deps.examineTimeoutMs ?? 120_000,
              "the examination took too long",
            ),
          );
        } catch (error) {
          if (error instanceof CensusPaused) paused ??= error;
          else results.set(link.url, unknownExamination(link, error, now()));
        }
        deps.onProgress?.({ ...progress, examined: results.size });
      });
      if (deps.signal?.aborted) return { stop: "aborted" };
      if (paused) return { stop: "paused", reason: (paused as CensusPaused).message };

      // commit the article, in document order so the result never depends on timing
      for (const link of links) {
        run.citations++;
        const ex = results.get(link.url) ?? run.findings[link.url];
        if (!ex || !REPORTED.includes(ex.verdict)) continue;
        const row = buildRow(link, ex, doc);
        const key = `${row.article}\n${row.url}\n${row.claim}`;
        if (rowKeys.has(key)) continue;
        rowKeys.add(key);
        run.rows.push(row);
      }
      for (const url of fresh.keys()) {
        const ex = results.get(url)!;
        seen.add(url);
        run.seenUrls.push(url);
        run.counts[ex.verdict]++;
        if (REPORTED.includes(ex.verdict)) run.findings[url] = slim(ex);
      }
      run.notChecked += doc.truncated + (doc.links.length - links.length);
    }

    run.done++;
    if (run.done >= run.articles.length) run.finishedAt = now().toISOString();
    await deps.save?.(run);
  }
  if (!run.finishedAt) {
    run.finishedAt = now().toISOString();
    await deps.save?.(run);
  }
  return { stop: "finished" };
}
