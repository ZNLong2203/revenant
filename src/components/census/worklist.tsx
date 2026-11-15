"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { sourceNote } from "@/core/census/report";
import type { CensusRow } from "@/core/census/types";
import { VerdictBadge } from "@/components/verdict";

const PAGE = 50;

/** The full scan of the article, where the patch can be copied. Nothing is edited from here. */
function scanHref(lang: string, title: string): string {
  return `/scan?q=${encodeURIComponent(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`)}`;
}

function Row({ row, lang }: { row: CensusRow; lang: string }) {
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerdictBadge verdict={row.verdict} />
        <span className="font-display text-xl text-bone">{row.article}</span>
        <span className="text-xs text-ash">confidence {Math.round(row.confidence * 100)}%</span>
        {sourceNote(row) && <span className="rounded-full border border-unknown/40 px-2 py-0.5 text-xs text-unknown">{sourceNote(row)}</span>}
      </div>
      {row.claim && <p className="mt-2 font-display text-lg italic text-bone-dim">“{row.claim}”</p>}
      {/* shown as text, never as a link: this address now belongs to someone else */}
      <p className="mt-1 break-all font-mono text-xs text-ash">{row.url}</p>
      {row.evidence.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-bone-dim">
          {row.evidence.map((e, i) => (
            <li key={`${i}:${e}`}>{e}</li>
          ))}
        </ul>
      )}
      {row.fix ? (
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-seam bg-ink p-3 font-mono text-xs text-bone-dim">{row.fix}</pre>
      ) : (
        <p className="mt-3 text-sm text-bone-dim">No archived copy was found, so this citation needs a new source.</p>
      )}
      <Link href={scanHref(lang, row.article)} className="mt-3 inline-block text-xs text-candle underline underline-offset-4">
        Scan this article and copy the patch →
      </Link>
    </li>
  );
}

export const Worklist = memo(function Worklist({ rows, lang, empty }: { rows: CensusRow[]; lang: string; empty: string }) {
  const [shown, setShown] = useState(PAGE);
  if (rows.length === 0) return <p className="rounded-2xl border border-seam bg-crypt/60 p-5 text-sm text-bone-dim">{empty}</p>;
  return (
    <>
      <ul className="divide-y divide-seam overflow-hidden rounded-2xl border border-seam bg-crypt/60">
        {rows.slice(0, shown).map((row, i) => (
          <Row key={`${row.article}|${row.url}|${i}`} row={row} lang={lang} />
        ))}
      </ul>
      {rows.length > shown && (
        <button onClick={() => setShown((n) => n + PAGE)} className="mt-3 rounded-xl border border-seam-strong px-4 py-2 text-sm text-bone-dim hover:text-bone">
          Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown} left
        </button>
      )}
    </>
  );
});
