/** Offline stand-ins for Wikipedia articles and the examine step, shared by the census tests. */
import { extractLinks } from "../../src/core/extract";
import type { Evidence, Examination, ExamineRequest, SourceDocument, Verdict } from "../../src/core/types";

export interface CiteSpec {
  /** Number n makes the URL http://site<n>.example.org/page<n>. */
  site: number;
  accessDate?: string;
  status?: string;
}

export const urlOf = (site: number) => `http://site${site}.example.org/page${site}`;

/** A wikitext article with one {{cite web}} per spec, each after its own sentence. */
export function article(title: string, cites: CiteSpec[]): SourceDocument {
  const text = cites
    .map(
      (c) =>
        `Sentence number ${c.site} says something checkable.<ref>{{cite web |url=${urlOf(c.site)} |title=Page ${c.site} |access-date=${c.accessDate ?? "6 March 2014"}${c.status ? ` |url-status=${c.status}` : ""}}}</ref>`,
    )
    .join("\n\n");
  return {
    id: title,
    format: "wikitext",
    title,
    origin: { type: "wikipedia", lang: "en", title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` },
    text,
    links: extractLinks(text, "wikitext"),
    truncated: 0,
  };
}

const ev = (signal: string, points: Verdict, weight: number): Evidence => ({ signal, points, weight, detail: `${signal} says ${points}.` });

/**
 * What the pretend network says about site n: n % 5 picks the story.
 * 0 possessed with two independent signals, 1 possessed with one, 2 ghost,
 * 3 alive, 4 buried.
 */
export function fakeExamination(req: ExamineRequest, now = new Date("2026-11-03T00:00:00Z")): Examination {
  const n = Number(req.url.match(/site(\d+)\./)?.[1] ?? 0);
  const story = n % 5;
  const verdict: Verdict = (["possessed", "possessed", "ghost", "alive", "buried"] as const)[story];
  const evidence: Evidence[] =
    story === 0
      ? [ev("rdap-reregistered", "possessed", 0.5), ev("spam-terms", "possessed", 0.9), ev("spam-redirect", "possessed", 0.8), ev("redirect-to-home", "ghost", 0.4)]
      : story === 1
        ? [ev("parking-page", "possessed", 0.9), ev("parking-host", "possessed", 0.93)]
        : story === 2
          ? [ev("soft-404-title", "ghost", 0.8)]
          : [];
  const problem = verdict === "possessed" || verdict === "ghost" || verdict === "buried";
  return {
    linkId: req.linkId,
    url: req.url,
    verdict,
    confidence: 0.5 + story / 10,
    summary: `${verdict}: pretend.`,
    evidence,
    claim: problem ? { archive: "supported", method: "lexical", rationale: "pretend" } : undefined,
    remedy: problem
      ? { action: "archive", urlStatus: verdict === "possessed" ? "usurped" : "dead", archiveUrl: `https://web.archive.org/web/20140320152702/${req.url}`, archiveDate: "2014-03-20" }
      : { action: "none" },
    examinedAt: now.toISOString(),
    durationMs: 1,
  };
}
