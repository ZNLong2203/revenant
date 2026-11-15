/**
 * Totals of the published censuses, written by `npm run census:publish` from
 * finished runs in .revenant/census/. Empty until one has been published.
 * The rows behind each run are committed in census/<runId>.csv.
 */
import type { Verdict } from "@/core/types";
import data from "./census.json";

export interface CensusSummary {
  runId: string;
  /** "Category:PHP", "links to example.com" or a title list label. */
  scope: string;
  lang: string;
  /** YYYY-MM-DD the census finished. */
  measuredOn: string;
  version: string;
  articles: number;
  moreArticles: boolean;
  citations: number;
  urls: number;
  counts: Record<Verdict, number>;
  untaggedPossessed: number;
  taggedPossessed: number;
  worklist: number;
  review: number;
  /**
   * Untagged possessed rows that someone opened and read on the live web
   * (census/<runId>.checks.json), and how many of those were confirmed.
   */
  checked?: { on: string; rows: number; confirmed: number };
  shareAffected: number;
  notChecked: number;
  articleErrors: number;
}

export const CENSUS = data as CensusSummary[];
