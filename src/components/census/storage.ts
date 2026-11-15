/**
 * Census runs live in this browser's localStorage. The hosted app cannot keep
 * a run on the server: a serverless function ends with its request, so the
 * browser drives the run one article at a time and remembers where it was.
 */
import type { CensusRun } from "@/core/census/types";
import { parseCensusRun } from "@/core/census/types";

const RUN = "revenant:census:run:";
const META = "revenant:census:meta:";

export interface StoredRun {
  id: string;
  label: string;
  createdAt: string;
  done: number;
  total: number;
  finished: boolean;
}

export function labelOf(run: CensusRun): string {
  const { kind, value, lang } = run.source;
  return `${kind === "category" ? "Category:" : kind === "domain" ? "links to " : ""}${value}${lang === "en" ? "" : ` (${lang})`}`;
}

/** Returns false when the browser refused (private mode, storage full). */
export function saveRun(run: CensusRun): boolean {
  try {
    const meta: StoredRun = { id: run.id, label: labelOf(run), createdAt: run.createdAt, done: run.done, total: run.articles.length, finished: Boolean(run.finishedAt) };
    localStorage.setItem(RUN + run.id, JSON.stringify(run));
    localStorage.setItem(META + run.id, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function loadRun(id: string): CensusRun | undefined {
  try {
    const text = localStorage.getItem(RUN + id);
    return text ? parseCensusRun(JSON.parse(text)) : undefined;
  } catch {
    return undefined;
  }
}

export function deleteRun(id: string): void {
  try {
    localStorage.removeItem(RUN + id);
    localStorage.removeItem(META + id);
  } catch {
    // nothing to remove
  }
}

/** Saved runs, newest first. */
export function listRuns(): StoredRun[] {
  const out: StoredRun[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(META)) continue;
      const meta = JSON.parse(localStorage.getItem(key) ?? "null") as StoredRun | null;
      if (meta?.id) out.push(meta);
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
