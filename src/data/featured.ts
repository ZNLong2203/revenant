/**
 * Recorded scans shipped in public/featured/<slug>.json (written by
 * `npm run featured`). They open instantly and keep the demo working when the
 * archive is slow.
 */
import type { Verdict } from "@/core/types";

export interface FeaturedScan {
  slug: string;
  kind: string;
  title: string;
  note: string;
  links: number;
  counts: Partial<Record<Verdict, number>>;
  recordedOn: string;
}

export const FEATURED: FeaturedScan[] = [];
