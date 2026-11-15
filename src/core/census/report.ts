/**
 * From a census run to something people can use: totals, a worklist, a review
 * list, a CSV and a wikitext table. Pure functions (spec: graveyard-census,
 * Requirements 3 and 4).
 */
import type { Verdict } from "../types";
import { VERDICTS } from "../types";
import type { CensusRow, CensusRun, CensusSource } from "./types";

export interface CensusTotals {
  articles: number;
  articlesDone: number;
  /** External links found in the finished articles, counting repeats. */
  citations: number;
  /** Distinct URLs examined. */
  urls: number;
  /** Verdict of each distinct URL. */
  counts: Record<Verdict, number>;
  untaggedPossessed: number;
  /** Possessed citations an editor already marked usurped or unfit. */
  taggedPossessed: number;
  /** Untagged rows with two or more independent signals. */
  worklist: number;
  /** Untagged rows with fewer, for a person to check first. */
  review: number;
  /** untaggedPossessed / citations, 0 to 1. */
  shareAffected: number;
  notChecked: number;
  articleErrors: number;
}

export interface CensusReport {
  meta: { id: string; source: CensusSource; createdAt: string; finishedAt?: string; version: string; moreArticles: boolean };
  totals: CensusTotals;
  worklist: CensusRow[];
  review: CensusRow[];
}

/** Rows need two independent signals to go on the main worklist. */
export const MIN_SIGNALS = 2;

const ORDER: Partial<Record<Verdict, number>> = { possessed: 0, ghost: 1, changeling: 2 };

const lt = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Untagged possessed first, then ghosts and changelings; strongest evidence first. */
export function compareRows(a: CensusRow, b: CensusRow): number {
  return (ORDER[a.verdict] ?? 9) - (ORDER[b.verdict] ?? 9) || b.confidence - a.confidence || lt(a.article, b.article) || lt(a.url, b.url);
}

export function buildReport(run: CensusRun): CensusReport {
  const open = run.rows.filter((r) => !r.tagged).sort(compareRows);
  const worklist = open.filter((r) => r.evidence.length >= MIN_SIGNALS);
  const review = open.filter((r) => r.evidence.length < MIN_SIGNALS);
  const untaggedPossessed = open.filter((r) => r.verdict === "possessed").length;
  return {
    meta: { id: run.id, source: run.source, createdAt: run.createdAt, finishedAt: run.finishedAt, version: run.version, moreArticles: run.moreArticles },
    totals: {
      articles: run.articles.length,
      articlesDone: run.done,
      citations: run.citations,
      urls: run.seenUrls.length,
      counts: run.counts,
      untaggedPossessed,
      taggedPossessed: run.rows.filter((r) => r.tagged && r.verdict === "possessed").length,
      worklist: worklist.length,
      review: review.length,
      shareAffected: run.citations ? untaggedPossessed / run.citations : 0,
      notChecked: run.notChecked,
      articleErrors: run.errors.length,
    },
    worklist,
    review,
  };
}

// ---- CSV ---------------------------------------------------------------------

const COLUMNS = ["section", "article", "claim", "url", "verdict", "confidence", "tagged", "needs_new_source", "evidence", "fix"] as const;

/** A cell that starts like a formula would run in a spreadsheet; wiki text and URLs are not ours to trust. */
const FORMULA_START = /^'*[=+\-@\t\r]/;

function guard(s: string): string {
  return FORMULA_START.test(s) ? `'${s}` : s;
}
function unguard(s: string): string {
  return /^'+[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}
function cell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** What a person should know about the source of a row: nothing, or why its archived copy cannot be trusted yet. */
export function sourceNote(row: Pick<CensusRow, "needsNewSource" | "fix">): string {
  if (!row.needsNewSource) return "";
  return row.fix ? "archived copy not confirmed against the sentence" : "needs a new source";
}

export function sectionOf(row: CensusRow): "tagged" | "worklist" | "review" {
  return row.tagged ? "tagged" : row.evidence.length >= MIN_SIGNALS ? "worklist" : "review";
}

/** RFC 4180 CSV. Cells that could run as spreadsheet formulas get a leading apostrophe. */
export function toCsv(rows: CensusRow[]): string {
  const lines = [COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        sectionOf(r),
        cell(guard(r.article)),
        cell(guard(r.claim)),
        cell(guard(r.url)),
        r.verdict,
        String(r.confidence),
        String(r.tagged),
        String(r.needsNewSource),
        cell(guard(r.evidence.join("\n"))),
        cell(guard(r.fix ?? "")),
      ].join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let started = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      started = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (started || field) {
        record.push(field);
        records.push(record);
      }
      record = [];
      field = "";
      started = false;
    } else {
      field += ch;
      started = true;
    }
  }
  if (started || field) {
    record.push(field);
    records.push(record);
  }
  return records;
}

/** The inverse of {@link toCsv}. Throws on a file that is not a census CSV. */
export function parseCsv(csv: string): CensusRow[] {
  const [header, ...records] = parseRecords(csv);
  if (!header) throw new Error("The CSV is empty.");
  const at = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`The CSV has no "${name}" column.`);
    return i;
  };
  const col = Object.fromEntries(COLUMNS.map((c) => [c, at(c)])) as Record<(typeof COLUMNS)[number], number>;
  return records.map((rec) => {
    const verdict = rec[col.verdict] as Verdict;
    if (!VERDICTS.includes(verdict)) throw new Error(`Unknown verdict "${rec[col.verdict]}".`);
    const evidence = unguard(rec[col.evidence] ?? "");
    const fix = unguard(rec[col.fix] ?? "");
    return {
      article: unguard(rec[col.article] ?? ""),
      claim: unguard(rec[col.claim] ?? ""),
      url: unguard(rec[col.url] ?? ""),
      verdict,
      confidence: Number(rec[col.confidence]),
      tagged: rec[col.tagged] === "true",
      evidence: evidence ? evidence.split("\n") : [],
      ...(fix ? { fix } : {}),
      needsNewSource: rec[col.needs_new_source] === "true",
    };
  });
}

// ---- wikitext ----------------------------------------------------------------

/**
 * Make text safe inside a wikitext table cell: no markup, templates, links,
 * pipes or line breaks survive. Colons are escaped too, so a bare URL is shown
 * but never turned into a link: a squatter's address is not promoted, and the
 * page cannot trip a spam blacklist when it is saved.
 */
export function wikiCell(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/'/g, "&#39;")
    .replace(/:/g, "&#58;");
}

function articleCell(title: string): string {
  // [[:Title]] links to the page even when the title starts like a File: or Category: name;
  // a real article title never holds these characters, so anything else is shown as plain text
  const t = title.trim();
  return t && /^[^|[\]{}<>#\n]+$/.test(t) ? `[[:${t}]]` : wikiCell(title);
}

function table(rows: CensusRow[]): string[] {
  const out = ['{| class="wikitable sortable"', "! Article !! Citing sentence !! URL !! Verdict !! Evidence !! Proposed fix"];
  for (const r of rows) {
    out.push(
      "|-",
      `| ${articleCell(r.article)}`,
      `| ${wikiCell(r.claim)}`,
      `| ${wikiCell(r.url)}`,
      `| ${wikiCell(`${r.verdict}${sourceNote(r) ? ` (${sourceNote(r)})` : ""}`)}`,
      `| ${wikiCell(r.evidence.join(" "))}`,
      `| ${wikiCell(r.fix ?? "")}`,
    );
  }
  out.push("|}");
  return out;
}

/** A page for a WikiProject: the worklist table, then the rows that need a human look first. */
export function toWikitext(report: CensusReport): string {
  const { meta, totals } = report;
  const scope = meta.source.kind === "category" ? `Category:${meta.source.value}` : meta.source.kind === "domain" ? `links to ${meta.source.value}` : "a list of articles";
  const lines = [
    `<!-- Generated by Revenant ${wikiCell(meta.version)} (run ${wikiCell(meta.id)}). Revenant edits nothing on Wikipedia: every row is a suggestion for an editor to check. -->`,
    `== Untagged problem citations ==`,
    `Census of ${wikiCell(scope)} on ${meta.createdAt.slice(0, 10)}: ${totals.articlesDone} of ${totals.articles} articles, ${totals.citations} citations, ${totals.urls} distinct URLs. ` +
      `${totals.untaggedPossessed} possessed citation${totals.untaggedPossessed === 1 ? "" : "s"} not yet tagged <code>usurped</code> or <code>unfit</code>.`,
    ...table(report.worklist),
  ];
  if (report.review.length) {
    lines.push("== Needs a closer look ==", "Fewer than two independent signals support these verdicts.", ...table(report.review));
  }
  return `${lines.join("\n")}\n`;
}
