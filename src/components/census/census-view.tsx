"use client";

import { useMemo, useState } from "react";
import { VerdictBadge } from "@/components/verdict";
import { buildReport, toCsv, toWikitext } from "@/core/census/report";
import { HOSTED_MAX_ARTICLES, DEFAULT_LIMIT, parseCensusRun } from "@/core/census/types";
import { VERDICTS } from "@/core/types";
import { labelOf, type StoredRun } from "./storage";
import { useCensus } from "./use-census";
import { Worklist } from "./worklist";

const nf = new Intl.NumberFormat("en-US");
const articles = (n: number) => `${nf.format(n)} article${n === 1 ? "" : "s"}`;
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, style: "percent" });

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-seam bg-crypt/60 p-4">
      {/* the display font has old-style figures: its zero looks like the letter o, so numbers use the body font */}
      <p className="text-3xl font-semibold tabular-nums text-bone">{value}</p>
      <p className="mt-1 text-sm text-bone-dim">{label}</p>
      {hint && <p className="mt-1 text-xs text-ash">{hint}</p>}
    </div>
  );
}

export function CensusView() {
  const { state, saved, start, stop, resume, open, openSaved, remove, reset } = useCensus();
  const [input, setInput] = useState("");
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));
  const [lang, setLang] = useState("en");
  const [fileError, setFileError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const { run, phase } = state;
  const report = useMemo(() => (run ? buildReport(run) : undefined), [run]);
  const busy = phase === "resolving" || phase === "running";
  const limitNumber = Number(limit);
  const limitOk = Number.isInteger(limitNumber) && limitNumber >= 1 && limitNumber <= HOSTED_MAX_ARTICLES;

  async function openFile(file: File | undefined) {
    if (!file) return;
    setFileError(undefined);
    try {
      open(parseCensusRun(JSON.parse(await file.text())));
    } catch {
      setFileError("That file is not a Revenant census run (the JSON saved by the CLI or by Download run).");
    }
  }

  async function copyWikitext() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(toWikitext(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFileError("The browser would not let Revenant use the clipboard. Download the wikitext instead.");
    }
  }

  const progress = state.progress;
  const shownDone = run ? run.done : 0;
  const total = run?.articles.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-candle">Graveyard census</p>
      <h1 className="mt-3 font-display text-4xl text-bone sm:text-5xl">How many possessed citations has nobody tagged?</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-bone-dim">
        Give Revenant a Wikipedia category, a domain, or a list of article titles. It examines every distinct link once and hands back a worklist of possessed
        citations that no editor has marked <span className="font-mono text-bone">usurped</span> or <span className="font-mono text-bone">unfit</span>, each with the
        evidence and the fix. Revenant never edits Wikipedia.
      </p>

      {/* ---- start a census --------------------------------------------------- */}
      <form
        className="mt-8 grid gap-4 rounded-2xl border border-seam bg-crypt/60 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && limitOk) void start({ input, limit: limitNumber, lang: lang.trim().toLowerCase() || "en" });
        }}
      >
        <div>
          <label htmlFor="census-input" className="text-sm text-bone">
            Category, domain or article titles
          </label>
          <textarea
            id="census-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={"Category:Internet Archive\ndomain:example.com\n(or one article title per line)"}
            className="mt-2 w-full rounded-xl border border-seam-strong bg-ink p-3 font-mono text-sm text-bone placeholder:text-ash focus:border-candle focus:outline-none"
          />
          <p className="mt-1 text-xs text-ash">Subcategories are not searched. A list of titles is used exactly as given.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="census-limit" className="block text-sm text-bone">
              Articles
            </label>
            <input
              id="census-limit"
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              aria-invalid={!limitOk}
              className="mt-2 w-28 rounded-xl border border-seam-strong bg-ink px-3 py-2 font-mono text-sm text-bone focus:border-candle focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="census-lang" className="block text-sm text-bone">
              Wikipedia
            </label>
            <input
              id="census-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              maxLength={12}
              className="mt-2 w-20 rounded-xl border border-seam-strong bg-ink px-3 py-2 font-mono text-sm text-bone focus:border-candle focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !input.trim() || !limitOk}
            className="rounded-xl bg-candle px-6 py-2.5 font-semibold text-ink shadow-[0_0_30px_-8px_var(--candle)] transition hover:bg-[#f6c66b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start census
          </button>
        </div>
        {!limitOk && <p className="text-sm text-possessed">Choose between 1 and {nf.format(HOSTED_MAX_ARTICLES)} articles. For more, run the CLI: npx tsx bin/revenant.ts census</p>}
        <p className="text-xs text-ash">
          Your browser drives the run and keeps its progress in this browser, so you can close the tab and come back. The public demo&apos;s hourly limits apply; for
          big censuses run <span className="font-mono">npx tsx bin/revenant.ts census</span>.
        </p>
      </form>

      {/* ---- saved runs ------------------------------------------------------ */}
      {(saved.length > 0 || fileError) && (
        <section aria-labelledby="saved" className="mt-8">
          <h2 id="saved" className="font-display text-2xl text-bone">
            Saved censuses
          </h2>
          {fileError && (
            <p role="alert" className="mt-2 text-sm text-possessed">
              {fileError}
            </p>
          )}
          <ul className="mt-3 divide-y divide-seam overflow-hidden rounded-2xl border border-seam bg-crypt/60">
            {saved.map((s: StoredRun) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="text-bone">{s.label}</span>
                  <span className="ml-2 text-xs text-ash">
                    {s.createdAt.slice(0, 10)} · {s.finished ? articles(s.total) : `${nf.format(s.done)} of ${articles(s.total)}`}
                  </span>
                </span>
                <button onClick={() => openSaved(s.id)} className="rounded-lg border border-seam-strong px-3 py-1 text-bone-dim hover:text-bone">
                  {s.finished ? "Open" : "Open and resume"}
                </button>
                <button onClick={() => remove(s.id)} aria-label={`Delete saved census ${s.label}`} className="rounded-lg px-2 py-1 text-ash hover:text-possessed">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-4 text-sm text-bone-dim">
        <label htmlFor="census-file">
          Open a run file saved by the CLI (<span className="font-mono">.revenant/census/*.json</span>) or downloaded below:
        </label>
        <input
          id="census-file"
          type="file"
          accept="application/json,.json"
          onChange={(e) => void openFile(e.target.files?.[0])}
          className="mt-2 block text-xs text-bone-dim file:mr-3 file:rounded-lg file:border file:border-seam-strong file:bg-crypt file:px-3 file:py-1.5 file:text-bone-dim hover:file:text-bone"
        />
      </div>

      {/* ---- status --------------------------------------------------------- */}
      <div role="status" aria-live="polite" className="mt-8">
        {phase === "resolving" && <p className="pending text-bone-dim">Looking up the articles…</p>}
        {phase === "error" && (
          <div role="alert" className="rounded-2xl border border-possessed/30 bg-possessed/5 p-5">
            <p className="text-bone">{state.message}</p>
            <button onClick={reset} className="mt-2 text-sm text-candle underline underline-offset-4">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ---- the run --------------------------------------------------------- */}
      {run && report && (
        <section aria-labelledby="run-title" className="mt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="run-title" className="truncate font-display text-3xl text-bone">
                {labelOf(run)}
              </h2>
              <p className="mt-1 text-sm text-bone-dim">
                {nf.format(shownDone)} of {articles(total)} · started {run.createdAt.slice(0, 10)} · Revenant {run.version}
                {run.moreArticles ? " · the source has more articles than the limit" : ""}
              </p>
            </div>
            {phase === "running" && (
              <button onClick={stop} disabled={state.stopping} className="rounded-xl border border-seam-strong px-4 py-2 text-sm text-bone hover:border-candle disabled:opacity-60">
                {state.stopping ? "Stopping…" : "Pause"}
              </button>
            )}
            {phase === "paused" && run.done < run.articles.length && (
              <button onClick={resume} className="rounded-xl bg-candle px-5 py-2 text-sm font-semibold text-ink hover:bg-[#f6c66b]">
                Resume
              </button>
            )}
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-seam" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-candle transition-all duration-500" style={{ width: `${total ? (shownDone / total) * 100 : 100}%` }} />
          </div>
          {phase === "running" && progress && (
            <p className="mt-2 truncate text-sm text-candle">
              {progress.article}: {progress.urls ? `${nf.format(progress.examined)} of ${nf.format(progress.urls)} new links examined` : "reading the article…"}
            </p>
          )}
          {phase === "paused" && state.message && <p className="mt-2 text-sm text-unknown">{state.message}</p>}
          {state.storageFailed && (
            <p className="mt-2 text-sm text-unknown">This browser would not store the run. Download it below if you want to keep it.</p>
          )}

          {/* totals */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat value={nf.format(report.totals.untaggedPossessed)} label="possessed citations nobody has tagged" hint={`${percent.format(report.totals.shareAffected)} of ${nf.format(report.totals.citations)} citations`} />
            <Stat value={nf.format(report.totals.taggedPossessed)} label="already tagged by editors" hint="found, and not on the worklist" />
            <Stat value={nf.format(report.totals.citations)} label="citations in the articles done" hint={`${nf.format(report.totals.urls)} distinct URLs examined once each`} />
            <Stat
              value={nf.format(report.totals.worklist)}
              label="on the worklist"
              hint={`${nf.format(report.totals.review)} more need a closer look${run.notChecked ? ` · ${nf.format(run.notChecked)} links not checked` : ""}`}
            />
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-label="Verdicts of the distinct URLs">
            {VERDICTS.filter((v) => report.totals.counts[v] > 0).map((v) => (
              <li key={v} className="flex items-center gap-1.5 text-sm text-bone-dim">
                <VerdictBadge verdict={v} /> {nf.format(report.totals.counts[v])}
              </li>
            ))}
          </ul>
          {run.errors.length > 0 && (
            <details className="mt-3 text-sm text-bone-dim">
              <summary className="cursor-pointer text-unknown">{articles(run.errors.length)} could not be loaded</summary>
              <ul className="mt-2 list-disc pl-5">
                {run.errors.map((e, i) => (
                  <li key={`${i}:${e.article}`}>
                    {e.article}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* exports */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => download(`${run.id}.csv`, toCsv([...report.worklist, ...report.review]), "text/csv")}
              className="rounded-xl border border-seam-strong px-4 py-2 text-sm text-bone-dim hover:text-bone"
            >
              Download CSV
            </button>
            <button onClick={() => void copyWikitext()} className="rounded-xl border border-seam-strong px-4 py-2 text-sm text-bone-dim hover:text-bone">
              {copied ? "Copied" : "Copy wikitext table"}
            </button>
            <button onClick={() => download(`${run.id}.wiki.txt`, toWikitext(report), "text/plain")} className="rounded-xl border border-seam-strong px-4 py-2 text-sm text-bone-dim hover:text-bone">
              Download wikitext
            </button>
            <button onClick={() => download(`${run.id}.json`, JSON.stringify(run), "application/json")} className="rounded-xl border border-seam-strong px-4 py-2 text-sm text-bone-dim hover:text-bone">
              Download run
            </button>
          </div>

          {/* the worklist */}
          <h3 className="mt-10 font-display text-2xl text-bone">Worklist <span className="font-sans text-xl text-bone-dim">· {nf.format(report.worklist.length)}</span></h3>
          <p className="mt-1 text-sm text-bone-dim">
            Untagged possessed citations first, then ghosts and changelings. Each has two or more independent signals. Addresses are shown as text, not links: they now
            belong to someone else.
          </p>
          <div className="mt-3">
            <Worklist rows={report.worklist} lang={run.source.lang} empty={phase === "done" ? "No untagged possessed citations were found in these articles." : "Nothing yet. Rows appear here as articles finish."} />
          </div>

          {report.review.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer font-display text-2xl text-bone">Needs a closer look <span className="font-sans text-xl text-bone-dim">· {nf.format(report.review.length)}</span></summary>
              <p className="mb-3 mt-1 text-sm text-bone-dim">Only one independent signal points to these verdicts, so a person should check before anyone edits.</p>
              <Worklist rows={report.review} lang={run.source.lang} empty="" />
            </details>
          )}
        </section>
      )}
    </div>
  );
}
