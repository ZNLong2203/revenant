/** Client-safe helpers for grouping links and counting verdicts. */
import type { ExtractedLink, Verdict } from "./types";
import { VERDICTS } from "./types";

export function emptyCounts(): Record<Verdict, number> {
  return Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<Verdict, number>;
}

/** Group links by URL + access date so each is examined once. */
export function uniqueTargets(links: ExtractedLink[]): ExtractedLink[][] {
  const groups = new Map<string, ExtractedLink[]>();
  for (const l of links) {
    const key = `${l.url}|${l.accessDate ?? ""}`;
    const g = groups.get(key);
    if (g) g.push(l);
    else groups.set(key, [l]);
  }
  return [...groups.values()];
}
