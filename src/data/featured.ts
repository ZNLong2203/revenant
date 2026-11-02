/**
 * Recorded scans shipped in public/featured/<slug>.json, indexed in
 * featured.json (both written by `npm run featured`).
 */
import type { Verdict } from "@/core/types";
import index from "./featured.json";

export interface FeaturedScan {
  slug: string;
  kind: string;
  title: string;
  note: string;
  links: number;
  counts: Partial<Record<Verdict, number>>;
  untaggedPossessed: number;
  recordedOn: string;
}

export const FEATURED: FeaturedScan[] = index as FeaturedScan[];
