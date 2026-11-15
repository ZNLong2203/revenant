/**
 * Production wiring for the census engine: real Wikipedia, the shared cache
 * and the same examine pipeline as everything else. Server-only (CLI, MCP).
 */
import { examineLink } from "../server";
import { loadDocument } from "../sources";
import { CensusPaused, runCensus, type CensusDeps, type CensusOutcome } from "./run";
import { isBusy } from "./targets";
import type { CensusRun } from "./types";

/**
 * Load an article. A busy or unreachable Wikipedia pauses the census instead
 * of marking article after article as failed; a missing article is recorded
 * and skipped.
 */
export function wikipediaLoader(lang: string): CensusDeps["load"] {
  return async (title) => {
    try {
      return await loadDocument({ kind: "wikipedia", lang, title });
    } catch (error) {
      if (isBusy(error)) throw new CensusPaused(error instanceof Error ? error.message : "Wikipedia is not answering");
      throw error;
    }
  };
}

/** Run a census with the real network. Everything else (save, abort, limits) comes from `extra`. */
export function runLiveCensus(run: CensusRun, extra: Omit<CensusDeps, "load" | "examine"> = {}): Promise<CensusOutcome> {
  return runCensus(run, { ...extra, load: wikipediaLoader(run.source.lang), examine: examineLink });
}
