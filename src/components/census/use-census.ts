"use client";
/**
 * The census page's state machine. The browser drives the run, article by
 * article, through the shared engine in src/core/census/run.ts, and saves it
 * after every article so a closed tab or a rate limit costs nothing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createRun, runCensus, type CensusProgress } from "@/core/census/run";
import type { CensusRun, CensusSource } from "@/core/census/types";
import { browserDeps } from "./browser-deps";
import { deleteRun, listRuns, loadRun, saveRun, type StoredRun } from "./storage";

export type Phase = "idle" | "resolving" | "running" | "paused" | "done" | "error";

export interface CensusState {
  phase: Phase;
  run?: CensusRun;
  progress?: CensusProgress;
  /** Why the run paused or failed, in words a person can act on. */
  message?: string;
  /** The browser would not store the run; the person should export it. */
  storageFailed?: boolean;
  stopping?: boolean;
}

export interface StartRequest {
  input: string;
  limit: number;
  lang: string;
}

export function useCensus() {
  const [state, setState] = useState<CensusState>({ phase: "idle" });
  const [saved, setSaved] = useState<StoredRun[]>([]);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    setSaved(listRuns());
    return () => controller.current?.abort();
  }, []);

  /** Stop whatever is running and make sure its late callbacks are ignored. */
  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  const drive = useCallback(async (run: CensusRun) => {
    const c = new AbortController();
    controller.current = c;
    const current = () => controller.current === c;
    setState({ phase: "running", run: { ...run } });
    try {
      const outcome = await runCensus(run, {
        ...browserDeps(run.source.lang, c.signal),
        signal: c.signal,
        concurrency: 6,
        save: (r) => {
          const ok = saveRun(r);
          setSaved(listRuns());
          if (current()) setState((s) => ({ ...s, run: { ...r }, storageFailed: !ok }));
        },
        onProgress: (progress) => {
          if (current()) setState((s) => ({ ...s, progress }));
        },
      });
      if (!current()) return;
      setState((s) => ({
        ...s,
        phase: outcome.stop === "finished" ? "done" : "paused",
        run: { ...run },
        progress: undefined,
        stopping: false,
        message: outcome.stop === "aborted" ? "Stopped. The article in progress will be redone when you resume." : outcome.reason,
      }));
    } catch (error) {
      if (!current()) return;
      setState((s) => ({ ...s, phase: "error", progress: undefined, stopping: false, message: error instanceof Error ? error.message : "The census failed." }));
    }
  }, []);

  const start = useCallback(
    async ({ input, limit, lang }: StartRequest) => {
      cancel();
      setState({ phase: "resolving" });
      try {
        const res = await fetch("/api/census/targets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input, limit, lang }) });
        const body = (await res.json().catch(() => ({}))) as { error?: string; source?: CensusSource; articles?: string[]; more?: boolean };
        if (!res.ok || !body.source || !body.articles) {
          throw new Error(res.status === 429 ? "Too many lookups this hour. Try again later, or use the CLI." : (body.error ?? "Could not look up those articles."));
        }
        const run = createRun(body.source, body.articles, { moreArticles: body.more });
        saveRun(run);
        setSaved(listRuns());
        await drive(run);
      } catch (error) {
        setState({ phase: "error", message: error instanceof Error ? error.message : "Could not start the census." });
      }
    },
    [cancel, drive],
  );

  /** Show a run (saved here or opened from a file) without running anything. */
  const open = useCallback((run: CensusRun) => {
    cancel();
    const ok = saveRun(run);
    setSaved(listRuns());
    setState({
      phase: run.finishedAt ? "done" : "paused",
      run,
      storageFailed: !ok,
      message: run.finishedAt ? undefined : `Stopped after ${run.done} of ${run.articles.length} articles. Resume to continue.`,
    });
  }, [cancel]);

  const openSaved = useCallback(
    (id: string) => {
      const run = loadRun(id);
      if (run) open(run);
      else setState({ phase: "error", message: "That saved census can no longer be read from this browser." });
    },
    [open],
  );

  const resume = useCallback(() => {
    if (state.run) void drive(state.run);
  }, [drive, state.run]);

  const stop = useCallback(() => {
    controller.current?.abort();
    setState((s) => ({ ...s, stopping: true }));
  }, []);

  const remove = useCallback((id: string) => {
    deleteRun(id);
    setSaved(listRuns());
    setState((s) => (s.run?.id === id && s.phase !== "running" ? { phase: "idle" } : s));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({ phase: "idle" });
  }, [cancel]);

  return { state, saved, start, stop, resume, open, openSaved, remove, reset };
}
