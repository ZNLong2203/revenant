"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { emptyCounts } from "@/core/group";
import type { Examination, ExtractedLink, Verdict } from "@/core/types";
import { VERDICTS } from "@/core/types";
import { clip } from "@/core/text";
import { SummonForm } from "@/components/summon-form";
import { Tombstone, VERDICT_META, VerdictBadge } from "@/components/verdict";
import { Autopsy } from "./autopsy";
import { RaisePanel, usePatch } from "./raise-panel";
import { useScan, type ScanSource } from "./use-scan";

const SEVERITY: Record<Verdict, number> = { possessed: 0, changeling: 1, ghost: 2, buried: 3, unknown: 4, alive: 5 };
type Filter = "problems" | "all" | Verdict;

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function useSource(): ScanSource | undefined {
  const params = useSearchParams();
  const q = params.get("q");
  const featured = params.get("featured");
  const paste = params.get("paste");
  return useMemo(() => {
    if (featured) return { featured };
    if (q) return { q };
    if (paste) {
      try {
        const text = sessionStorage.getItem("revenant:paste");
        if (text) return { paste: text };
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [q, featured, paste]);
}

export function ScanView() {
  const source = useSource();
  const { state, rerun } = useScan(source);
  const [filter, setFilter] = useState<Filter>("problems");
  const [selected, setSelected] = useState<string>();
  const [raising, setRaising] = useState(false);
  const plan = usePatch(state.doc, state.results);

  const links = useMemo(() => state.doc?.links ?? [], [state.doc]);
  const counts = useMemo(() => {
    const c = emptyCounts();
    for (const l of links) {
      const ex = state.results[l.id];
      if (ex) c[ex.verdict]++;
    }
    return c;
  }, [links, state.results]);
  const examined = links.length - state.pending.size;
  const problems = counts.possessed + counts.changeling + counts.ghost + counts.buried;

  const visible = useMemo(() => {
    const rows = links.map((l) => ({ link: l, ex: state.results[l.id] as Examination | undefined }));
    const keep = rows.filter(({ ex }) => {
      if (filter === "all") return true;
      if (!ex) return filter === "problems";
      if (filter === "problems") return ex.verdict !== "alive";
      return ex.verdict === filter;
    });
    return keep.sort((a, b) => {
      const sa = a.ex ? SEVERITY[a.ex.verdict] : 4.5;
      const sb = b.ex ? SEVERITY[b.ex.verdict] : 4.5;
      return sa - sb || a.link.span.start - b.link.span.start;
    });
  }, [links, state.results, filter]);

  // until someone picks a grave, the desktop autopsy shows the worst one found so far
  const worstId = visible.find((r) => r.ex?.verdict === "possessed")?.link.id ?? visible.find((r) => r.ex && r.ex.verdict !== "alive")?.link.id;

  const selectedLink = links.find((l) => l.id === (selected ?? worstId));

  if (!source) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl text-bone">Name the dead</h1>
        <p className="mt-2 text-bone-dim">Give Revenant a Wikipedia article, a GitHub README or any page with citations.</p>
        <div className="mt-6">
          <SummonForm />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-6 sm:px-6">
      {/* ---- header -------------------------------------------------------- */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-ash">
            {state.doc?.origin.type === "wikipedia" ? `Wikipedia · ${state.doc.origin.lang}` : state.doc?.origin.type === "github" ? "GitHub" : state.doc?.origin.type === "web" ? "Web page" : "Exhumation"}
            {"featured" in source ? " · recorded scan" : ""}
          </p>
          <h1 className="mt-1 truncate font-display text-4xl text-bone sm:text-5xl">{state.doc?.title ?? (state.phase === "error" ? "The grave is empty" : "Digging…")}</h1>
          {state.doc && (
            <p className="mt-2 text-sm text-bone-dim">
              {links.length} link{links.length === 1 ? "" : "s"} found
              {state.doc.truncated ? ` (${state.doc.truncated} more not checked)` : ""} ·{" "}
              {state.phase === "examining" ? (
                <span className="text-candle">
                  examined {examined} of {links.length}
                </span>
              ) : state.phase === "done" ? (
                <span>
                  {problems} need{problems === 1 ? "s" : ""} attention
                  {state.finishedAt && state.startedAt && !("featured" in source) ? ` · ${Math.max(1, Math.round((state.finishedAt - state.startedAt) / 1000))}s` : ""}
                </span>
              ) : null}
              {state.doc.origin.type === "wikipedia" && (
                <>
                  {" · "}
                  <a href={state.doc.origin.url} target="_blank" rel="noreferrer" className="text-ash underline decoration-seam-strong underline-offset-4 hover:text-bone">
                    article text by Wikipedia contributors, CC BY-SA 4.0
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          {plan?.patch && (
            <button
              onClick={() => setRaising(true)}
              className="rounded-xl bg-candle px-5 py-3 font-semibold text-ink shadow-[0_0_40px_-10px_var(--candle)] transition hover:bg-[#f6c66b]"
            >
              Raise the dead · {plan.patch.applied.length}
            </button>
          )}
          <div className="w-full min-w-0 sm:min-w-[260px] lg:w-[360px]">
            <SummonForm compact initial={"q" in source ? source.q : ""} />
          </div>
        </div>
      </section>

      {state.phase === "error" && (
        <div className="mt-10 rounded-2xl border border-possessed/30 bg-possessed/5 p-6">
          <p className="text-bone">{state.error}</p>
          <button onClick={rerun} className="mt-3 text-sm text-candle underline underline-offset-4">
            Try again
          </button>
        </div>
      )}

      {state.throttled && (
        <p role="status" className="mt-4 rounded-xl border border-unknown/30 bg-unknown/5 p-3 text-sm text-unknown">
          The public demo&apos;s hourly limit was reached, so the rest of this scan is paused. Results so far are kept. Run Revenant locally for large scans.
        </p>
      )}

      {state.doc && (
        <>
          {/* ---- graveyard map --------------------------------------------- */}
          <section aria-label="Graveyard" className="relative mt-6 overflow-hidden rounded-2xl border border-seam bg-crypt/70 p-4">
            <div className="fog pointer-events-none absolute -bottom-10 left-0 right-0 h-24 bg-gradient-to-t from-bone/[0.04] to-transparent blur-xl" aria-hidden="true" />
            <div className="flex flex-wrap gap-1.5" role="list">
              {links.map((l) => {
                const ex = state.results[l.id];
                return (
                  <button
                    key={l.id}
                    role="listitem"
                    onClick={() => setSelected(l.id)}
                    title={`${ex ? VERDICT_META[ex.verdict].label : "Examining"} · ${l.url}`}
                    aria-label={`${ex ? VERDICT_META[ex.verdict].label : "Examining"}: ${host(l.url)}`}
                    className={`rounded transition hover:-translate-y-0.5 ${selectedLink?.id === l.id ? "ring-2 ring-candle" : ""}`}
                  >
                    <Tombstone verdict={ex?.verdict} pending={!ex && state.pending.has(l.id)} size={18} />
                  </button>
                );
              })}
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-seam" aria-hidden="true">
              <div className="h-1 rounded-full bg-candle transition-all duration-500" style={{ width: `${links.length ? (examined / links.length) * 100 : 100}%` }} />
            </div>
          </section>

          {/* ---- filters ---------------------------------------------------- */}
          <div className="mt-5 flex flex-wrap gap-2" role="toolbar" aria-label="Filter by verdict">
            {(["problems", ...VERDICTS, "all"] as Filter[]).map((f) => {
              const n = f === "problems" ? problems + counts.unknown : f === "all" ? links.length : counts[f as Verdict];
              if (f !== "problems" && f !== "all" && n === 0) return null;
              const active = filter === f;
              const meta = f !== "problems" && f !== "all" ? VERDICT_META[f as Verdict] : undefined;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    active ? "border-candle bg-candle/10 text-bone" : "border-seam-strong text-bone-dim hover:text-bone"
                  }`}
                >
                  {meta && (
                    <span aria-hidden="true" className={`mr-1 ${meta.text}`}>
                      {meta.glyph}
                    </span>
                  )}
                  {f === "problems" ? "Needs attention" : f === "all" ? "All" : meta!.label} <span className="text-ash">{n}</span>
                </button>
              );
            })}
          </div>

          {/* ---- list + autopsy ------------------------------------------ */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
            <ul className="divide-y divide-seam overflow-hidden rounded-2xl border border-seam bg-crypt/60">
              {visible.length === 0 && (
                <li className="p-6 text-sm text-bone-dim">
                  {state.phase === "done" ? "No links in this group. Every cited page here still looks like itself." : "Waiting for the first verdicts…"}
                </li>
              )}
              {visible.map(({ link, ex }) => (
                <GraveRow key={link.id} link={link} ex={ex} active={selectedLink?.id === link.id} onSelect={() => setSelected(link.id)} />
              ))}
            </ul>
            <aside
              className={`${
                selected ? "fixed inset-0 z-40 lg:static lg:z-auto" : "hidden lg:block"
              } overflow-hidden border-seam bg-crypt lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:rounded-2xl lg:border`}
            >
              {selectedLink ? (
                <Autopsy link={selectedLink} ex={state.results[selectedLink.id]} onClose={() => setSelected(undefined)} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-10 text-center text-bone-dim">
                  <Tombstone verdict="possessed" size={42} />
                  <p className="mt-4 font-display text-xl text-bone">Choose a grave</p>
                  <p className="mt-1 text-sm">The autopsy shows the timeline, the archived page next to today&apos;s page, and the evidence.</p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {raising && state.doc && <RaisePanel doc={state.doc} results={state.results} onClose={() => setRaising(false)} />}
    </div>
  );
}

function GraveRow({ link, ex, active, onSelect }: { link: ExtractedLink; ex?: Examination; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button onClick={onSelect} aria-current={active} className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-vault/60 ${active ? "bg-vault/80" : ""}`}>
        <span className="mt-0.5">
          <Tombstone verdict={ex?.verdict} pending={!ex} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {ex ? <VerdictBadge verdict={ex.verdict} /> : <span className="pending text-xs text-ash">examining…</span>}
            <span className="truncate font-mono text-xs text-bone-dim">{host(link.url)}</span>
            {link.accessDate && <span className="text-xs text-ash">cited {link.accessDate}</span>}
          </span>
          <span className="mt-1 block truncate text-sm text-bone">{link.title ? clip(link.title, 120) : clip(link.context || link.url, 120)}</span>
          {ex && ex.verdict !== "alive" && <span className="mt-0.5 block truncate text-xs text-ash">{ex.summary.replace(/^\w+: /, "")}</span>}
        </span>
      </button>
    </li>
  );
}
