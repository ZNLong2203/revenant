"use client";

/**
 * The scan state machine: load the document, then examine links with a small
 * worker pool so verdicts stream into the graveyard as they arrive.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { uniqueTargets } from "@/core/group";
import type { Examination, ExtractedLink, SourceDocument } from "@/core/types";

export type Phase = "loading" | "examining" | "done" | "error";

export interface ScanState {
  phase: Phase;
  doc?: SourceDocument;
  results: Record<string, Examination>;
  pending: Set<string>;
  error?: string;
  throttled?: boolean;
  startedAt?: number;
  finishedAt?: number;
}

const CONCURRENCY = 6;

async function examineOne(link: ExtractedLink, signal: AbortSignal): Promise<Examination | "throttled" | undefined> {
  const res = await fetch("/api/examine", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      linkId: link.id,
      url: link.url,
      title: link.title,
      context: link.context?.slice(0, 2000),
      accessDate: link.accessDate,
      quote: link.quote?.slice(0, 2000),
      existingArchive: link.existingArchive,
    }),
  });
  if (res.status === 429) return "throttled";
  if (!res.ok) return undefined;
  return (await res.json()) as Examination;
}

export type ScanSource = { q: string } | { paste: string } | { featured: string };

export function useScan(source: ScanSource | undefined) {
  const [state, setState] = useState<ScanState>({ phase: "loading", results: {}, pending: new Set() });
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (src: ScanSource) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ phase: "loading", results: {}, pending: new Set(), startedAt: Date.now() });

    try {
      if ("featured" in src) {
        const res = await fetch(`/featured/${encodeURIComponent(src.featured)}.json`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("That featured exhumation is not available.");
        const data = (await res.json()) as { doc: SourceDocument; results: Record<string, Examination> };
        setState({ phase: "done", doc: data.doc, results: data.results, pending: new Set(), startedAt: Date.now(), finishedAt: Date.now() });
        return;
      }
      const res = await fetch("/api/exhume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ input: "q" in src ? src.q : src.paste }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load that source.");
      const doc = body as SourceDocument;
      const groups = uniqueTargets(doc.links);
      setState((s) => ({ ...s, phase: groups.length ? "examining" : "done", doc, pending: new Set(doc.links.map((l) => l.id)), finishedAt: groups.length ? undefined : Date.now() }));

      let next = 0;
      let throttled = false;
      const worker = async () => {
        while (next < groups.length && !ctrl.signal.aborted && !throttled) {
          const group = groups[next++];
          let ex: Examination | "throttled" | undefined;
          try {
            ex = await examineOne(group[0], ctrl.signal);
          } catch {
            if (ctrl.signal.aborted) return;
            ex = undefined;
          }
          if (ex === "throttled") {
            throttled = true;
            setState((s) => ({ ...s, throttled: true }));
            return;
          }
          setState((s) => {
            const results = { ...s.results };
            const pending = new Set(s.pending);
            for (const l of group) {
              pending.delete(l.id);
              if (ex) results[l.id] = { ...ex, linkId: l.id };
            }
            return { ...s, results, pending };
          });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, groups.length) }, worker));
      if (!ctrl.signal.aborted) setState((s) => ({ ...s, phase: "done", finishedAt: Date.now() }));
    } catch (error) {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ ...s, phase: "error", error: (error as Error).message }));
    }
  }, []);

  useEffect(() => {
    if (source) void run(source);
    return () => abort.current?.abort();
  }, [source, run]);

  return { state, rerun: () => source && run(source) };
}
