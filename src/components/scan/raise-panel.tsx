"use client";

import { useMemo, useState } from "react";
import { applyFixes, planFix } from "@/core/patch";
import type { Examination, SourceDocument } from "@/core/types";

function takeover(ex: Examination) {
  return ex.evidence.some((e) => e.signal === "rdap-reregistered") ? ex.domain?.registeredAt?.slice(0, 10) : undefined;
}

function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function usePatch(doc: SourceDocument | undefined, results: Record<string, Examination>) {
  return useMemo(() => {
    if (!doc) return undefined;
    const fixes = doc.links.flatMap((l) => {
      const ex = results[l.id];
      const fix = ex ? planFix(l, ex, takeover(ex)) : undefined;
      return fix ? [fix] : [];
    });
    if (!fixes.length) return { fixes, patch: undefined };
    const base = doc.origin.type === "github" ? doc.origin.path : doc.title.replace(/[^\w.-]+/g, "_");
    return { fixes, patch: applyFixes(doc.text, fixes, doc.format, base) };
  }, [doc, results]);
}

export function RaisePanel({ doc, results, onClose }: { doc: SourceDocument; results: Record<string, Examination>; onClose: () => void }) {
  const plan = usePatch(doc, results);
  const [copied, setCopied] = useState<string>();
  const patch = plan?.patch;
  if (!patch) return null;

  const counts = patch.applied.reduce<Record<string, number>>((acc, a) => ((acc[a.verdict] = (acc[a.verdict] ?? 0) + 1), acc), {});
  const summary = `Revenant: ${Object.entries(counts)
    .map(([v, n]) => `${n} ${v === "possessed" ? "usurped" : v === "changeling" ? "deviated" : "dead"}`)
    .join(", ")} citation${patch.applied.length === 1 ? "" : "s"}; added Wayback copies captured before the page changed`;

  const editUrl =
    doc.origin.type === "wikipedia"
      ? `https://${doc.origin.lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(doc.origin.title.replace(/ /g, "_"))}&action=edit&summary=${encodeURIComponent(summary)}`
      : doc.origin.type === "github"
        ? `https://github.com/${doc.origin.repo}/edit/${doc.origin.ref}/${doc.origin.path}`
        : undefined;

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(undefined), 1800);
    } catch {
      setCopied("Copy blocked by the browser");
    }
  }

  const lines = patch.diff.split("\n").slice(2);
  const ext = doc.format === "wikitext" ? "wiki" : doc.format === "markdown" ? "md" : doc.format === "html" ? "html" : "txt";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="raise-title" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-seam-strong bg-crypt shadow-2xl sm:rounded-2xl">
        <header className="flex items-start gap-4 border-b border-seam p-5">
          <div className="flex-1">
            <h2 id="raise-title" className="font-display text-3xl text-bone">
              Raise the dead
            </h2>
            <p className="mt-1 text-sm text-bone-dim">
              {patch.applied.length} link{patch.applied.length === 1 ? "" : "s"} rewritten
              {patch.skipped.length ? `, ${patch.skipped.length} left for a person` : ""}. Nothing is saved anywhere until you paste it yourself.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-seam-strong px-2.5 py-1 text-sm text-bone-dim hover:text-bone" aria-label="Close">
            ✕
          </button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-seam p-4">
          <button onClick={() => copy("Patched source copied", patch.text)} className="rounded-lg bg-candle px-4 py-2 text-sm font-semibold text-ink hover:bg-[#f6c66b]">
            Copy patched source
          </button>
          <button onClick={() => download(`revenant.patch`, patch.diff)} className="rounded-lg border border-seam-strong px-4 py-2 text-sm text-bone hover:border-candle">
            Download .patch
          </button>
          <button onClick={() => download(`revenant-patched.${ext}`, patch.text)} className="rounded-lg border border-seam-strong px-4 py-2 text-sm text-bone hover:border-candle">
            Download file
          </button>
          {editUrl && (
            <a href={editUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-seam-strong px-4 py-2 text-sm text-bone hover:border-candle">
              Open {doc.origin.type === "wikipedia" ? "Wikipedia" : "GitHub"} editor ↗
            </a>
          )}
          {doc.origin.type === "wikipedia" && (
            <button onClick={() => copy("Edit summary copied", summary)} className="rounded-lg border border-seam-strong px-4 py-2 text-sm text-bone hover:border-candle">
              Copy edit summary
            </button>
          )}
          <span role="status" className="self-center text-sm text-alive">
            {copied}
          </span>
        </div>

        <pre className="flex-1 overflow-auto bg-ink p-4 font-mono text-[12px] leading-relaxed" aria-label="Unified diff">
          {lines.map((line, i) => (
            <div
              key={i}
              className={line.startsWith("+") ? "diff-add" : line.startsWith("-") ? "diff-del" : line.startsWith("@@") ? "diff-hunk" : "text-ash"}
            >
              {line.length > 600 ? `${line.slice(0, 600)}…` : line || " "}
            </div>
          ))}
        </pre>

        {patch.skipped.length > 0 && (
          <details className="border-t border-seam p-4 text-sm text-bone-dim">
            <summary className="cursor-pointer">Left for a person ({patch.skipped.length})</summary>
            <ul className="mt-2 space-y-1">
              {patch.skipped.map((s) => (
                <li key={s.linkId} className="break-all font-mono text-xs">
                  {s.url} · {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
