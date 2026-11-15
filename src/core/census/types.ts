/**
 * The Graveyard Census data model (spec: .kiro/specs/graveyard-census).
 * Plain data only, so a run can be saved as JSON and reopened in the browser,
 * the CLI or a test.
 */
import { z } from "zod";
import type { Examination, Verdict } from "../types";
import { VERDICTS } from "../types";

export type CensusSourceKind = "category" | "domain" | "titles";

export interface CensusSource {
  kind: CensusSourceKind;
  /** Category name (without "Category:"), domain, or a short label for a title list. */
  value: string;
  /** Wikipedia language edition, e.g. "en". */
  lang: string;
}

/** One citation Revenant found a problem with. */
export interface CensusRow {
  article: string;
  /** The sentence that cites the link, plain text on one line. */
  claim: string;
  url: string;
  verdict: Verdict;
  confidence: number;
  /** The citation already carries the `url-status` Revenant would write. */
  tagged: boolean;
  /** One plain sentence per independent signal that points to `verdict`. */
  evidence: string[];
  /** The proposed citation change, if there is one. */
  fix?: string;
  /** No archived copy that supports the sentence: a person must find another source. */
  needsNewSource: boolean;
}

export interface CensusRun {
  id: string;
  createdAt: string;
  finishedAt?: string;
  /** Revenant version that produced the run. */
  version: string;
  source: CensusSource;
  /** Titles in the order they are examined. */
  articles: string[];
  /** The source had more articles than the limit. */
  moreArticles: boolean;
  /** Articles finished; a resumed run starts at this index. */
  done: number;
  /** Every URL examined so far (a census never examines one twice). */
  seenUrls: string[];
  /** External links found in finished articles, counting repeats. */
  citations: number;
  /** Links skipped because an article had more than the per-article limit. */
  notChecked: number;
  /** Verdict of each distinct URL examined. */
  counts: Record<Verdict, number>;
  /** Examinations of URLs with a reportable verdict, so a later citation of the same URL needs no new request. */
  findings: Record<string, Examination>;
  rows: CensusRow[];
  /** Articles that could not be loaded; they count as finished. */
  errors: { article: string; message: string }[];
}

/** Verdicts that go on a worklist. Buried links are plain dead links that existing tools find. */
export const REPORTED: readonly Verdict[] = ["possessed", "ghost", "changeling"] as const;

/** The most articles the hosted app will census; larger runs belong on the CLI. */
export const HOSTED_MAX_ARTICLES = 2000;
/** Default number of articles when the user gives no limit. */
export const DEFAULT_LIMIT = 200;
/** Most articles an agent can census through MCP. */
export const MCP_MAX_ARTICLES = 50;

const verdictSchema = z.enum(VERDICTS as [Verdict, ...Verdict[]]);

const rowSchema = z.object({
  article: z.string(),
  claim: z.string(),
  url: z.string(),
  verdict: verdictSchema,
  confidence: z.number(),
  tagged: z.boolean(),
  evidence: z.array(z.string()),
  fix: z.string().optional(),
  needsNewSource: z.boolean(),
});

/** Validates a run read from a file or browser storage before it is trusted. */
export const censusRunSchema = z.object({
  id: z.string().regex(/^[\w-]{1,80}$/),
  createdAt: z.string(),
  finishedAt: z.string().optional(),
  version: z.string(),
  source: z.object({ kind: z.enum(["category", "domain", "titles"]), value: z.string(), lang: z.string().regex(/^[a-z]{2,12}(?:-[a-z]{2,12})?$/) }),
  articles: z.array(z.string()),
  moreArticles: z.boolean(),
  done: z.number().int().min(0),
  seenUrls: z.array(z.string()),
  citations: z.number().int().min(0),
  notChecked: z.number().int().min(0),
  counts: z.object(Object.fromEntries(VERDICTS.map((v) => [v, z.number().int().min(0)])) as Record<Verdict, z.ZodNumber>),
  findings: z.record(z.string(), z.custom<Examination>((v) => typeof v === "object" && v !== null)),
  rows: z.array(rowSchema),
  errors: z.array(z.object({ article: z.string(), message: z.string() })),
});

export function parseCensusRun(value: unknown): CensusRun {
  return censusRunSchema.parse(value) as CensusRun;
}
