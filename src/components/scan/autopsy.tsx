"use client";

import type { Examination, ExtractedLink } from "@/core/types";
import { clip } from "@/core/text";
import { VERDICT_META, VerdictBadge } from "@/components/verdict";

function fmtDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function host(url?: string) {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return url ?? "";
  }
}

interface Moment {
  date?: string;
  label: string;
  detail?: string;
  tone: "bone" | "candle" | "possessed" | "ash";
}

function timeline(link: ExtractedLink, ex: Examination): Moment[] {
  const out: Moment[] = [];
  if (ex.archive?.firstSeen && ex.archive.firstSeen < (link.accessDate ?? "9999"))
    out.push({ date: ex.archive.firstSeen, label: "In the archive", detail: "The Wayback Machine already held a copy by this date", tone: "ash" });
  if (link.accessDate) out.push({ date: link.accessDate, label: "Cited", detail: "The author read the page on this date", tone: "bone" });
  if (ex.remedy.archiveDate || ex.archive?.snapshot)
    out.push({
      date: ex.remedy.archiveDate ?? `${ex.archive!.snapshot!.timestamp.slice(0, 4)}-${ex.archive!.snapshot!.timestamp.slice(4, 6)}-${ex.archive!.snapshot!.timestamp.slice(6, 8)}`,
      label: "Copy to raise",
      detail: "The archived copy Revenant will point to",
      tone: "candle",
    });
  const takeover = ex.evidence.find((e) => e.signal === "rdap-reregistered");
  if (takeover && ex.domain?.registeredAt)
    out.push({ date: ex.domain.registeredAt.slice(0, 10), label: "New owner", detail: `${ex.domain.domain} registered again (RDAP)`, tone: "possessed" });
  out.push({
    date: ex.examinedAt.slice(0, 10),
    label: "Today",
    detail: ex.live?.ok ? `${ex.live.status} OK${ex.live.finalUrl && host(ex.live.finalUrl) !== host(ex.url) ? ` → ${host(ex.live.finalUrl)}` : ex.live.finalUrl !== ex.url && ex.live.redirects.length ? " after redirect" : ""}` : ex.live?.status ? `HTTP ${ex.live.status}` : (ex.live?.error ?? "unreachable"),
    tone: ex.verdict === "alive" ? "bone" : "possessed",
  });
  return out.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

const TONE: Record<Moment["tone"], string> = {
  bone: "bg-bone",
  candle: "bg-candle",
  possessed: "bg-possessed",
  ash: "bg-ash",
};

export function Autopsy({ link, ex, onClose }: { link: ExtractedLink; ex?: Examination; onClose: () => void }) {
  if (!ex) {
    return (
      <div className="p-6 text-bone-dim">
        <p className="pending">Examining {host(link.url)}…</p>
      </div>
    );
  }
  const m = VERDICT_META[ex.verdict];
  const moments = timeline(link, ex);
  const liveTitle = ex.live?.title;
  return (
    <article aria-labelledby="autopsy-title" className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-seam bg-crypt/95 p-5 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={ex.verdict} size="md" />
            <span className="text-xs text-ash">confidence {Math.round(ex.confidence * 100)}%</span>
          </div>
          <h2 id="autopsy-title" className="mt-3 font-display text-2xl leading-tight text-bone">
            {link.title ? clip(link.title, 120) : host(link.url)}
          </h2>
          <p className="mt-1 break-all font-mono text-xs text-bone-dim">{link.url}</p>
        </div>
        <button onClick={onClose} className="rounded-lg border border-seam-strong px-2.5 py-1 text-sm text-bone-dim hover:text-bone" aria-label="Close autopsy">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <p className={`text-[15px] leading-relaxed ${m.text}`}>{ex.summary}</p>

        {link.context && (
          <figure className="border-l-2 border-candle/60 pl-4">
            <figcaption className="mb-1 text-xs uppercase tracking-wider text-ash">The sentence that cites it</figcaption>
            <blockquote className="font-display text-lg italic leading-snug text-bone">“{clip(link.context, 320)}”</blockquote>
          </figure>
        )}

        <section aria-label="Timeline">
          <h3 className="mb-3 text-xs uppercase tracking-wider text-ash">Timeline</h3>
          <ol className="relative space-y-3 border-l border-seam-strong pl-5">
            {moments.map((mo, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${TONE[mo.tone]} ring-4 ring-crypt`} aria-hidden="true" />
                <p className="text-sm text-bone">
                  <span className="font-mono text-xs text-bone-dim">{fmtDate(mo.date)}</span> · {mo.label}
                </p>
                {mo.detail && <p className="text-xs text-ash">{mo.detail}</p>}
              </li>
            ))}
          </ol>
        </section>

        {(ex.archive?.title || ex.archive?.text || ex.live) && (
          <section aria-label="Then and now" className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-candle/30 bg-vault/60 p-4">
              <p className="text-xs uppercase tracking-wider text-candle">Then · archived</p>
              {ex.archive?.title || ex.archive?.text ? (
                <>
                  <p className="mt-2 font-medium text-bone">{ex.archive.title ?? "Untitled"}</p>
                  <p className="mt-1 text-sm leading-relaxed text-bone-dim">{clip(ex.archive.text ?? "", 280)}</p>
                  {ex.archive.url && (
                    <a href={ex.archive.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-candle underline underline-offset-4">
                      Open archived copy ↗
                    </a>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-ash">No archived text was needed or found.</p>
              )}
            </div>
            <div className={`rounded-xl border p-4 ${ex.verdict === "alive" ? "border-seam bg-vault/40" : "border-possessed/30 bg-possessed/5"}`}>
              <p className={`text-xs uppercase tracking-wider ${ex.verdict === "alive" ? "text-ash" : "text-possessed"}`}>Now · live</p>
              {ex.live?.ok ? (
                <>
                  <p className="mt-2 font-medium text-bone">{liveTitle ?? "Untitled"}</p>
                  <p className="mt-1 text-sm leading-relaxed text-bone-dim">{clip(ex.live.text ?? "", 280)}</p>
                  {ex.live.finalUrl && <p className="mt-2 break-all font-mono text-[11px] text-ash">{ex.live.finalUrl}</p>}
                </>
              ) : (
                <p className="mt-2 text-sm text-bone-dim">{ex.live?.status ? `HTTP ${ex.live.status}` : (ex.live?.error ?? "Unreachable")}</p>
              )}
            </div>
          </section>
        )}

        <section aria-label="Evidence">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-ash">Evidence</h3>
          <ul className="space-y-2">
            {ex.evidence.map((e, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1 w-14 shrink-0">
                  <span className="block h-1.5 rounded-full bg-seam">
                    <span className="block h-1.5 rounded-full" style={{ width: `${Math.round(e.weight * 100)}%`, background: VERDICT_META[e.points].fill }} />
                  </span>
                </span>
                <span className="text-bone-dim">
                  <span className={`${VERDICT_META[e.points].text} font-medium`}>{VERDICT_META[e.points].label}</span> · {e.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {ex.claim && (
          <section aria-label="Claim check" className="rounded-xl border border-seam bg-vault/40 p-4">
            <h3 className="text-xs uppercase tracking-wider text-ash">Does the archived copy back the claim?</h3>
            <p className="mt-2 text-sm text-bone">
              <span className={ex.claim.archive === "supported" ? "text-alive" : ex.claim.archive === "partial" ? "text-unknown" : "text-possessed"}>
                {ex.claim.archive === "supported" ? "Yes" : ex.claim.archive === "partial" ? "Partly" : ex.claim.archive === "unsupported" ? "Not clearly" : "Can't tell"}
              </span>{" "}
              · {ex.claim.rationale}
            </p>
            {ex.claim.quote && <p className="mt-2 border-l border-seam-strong pl-3 text-sm italic text-bone-dim">“{ex.claim.quote}”</p>}
            <p className="mt-2 text-[11px] text-ash">{ex.claim.method === "llm" ? `Checked by ${ex.claim.model ?? "a language model"}` : "Checked by word overlap (no model)"}</p>
          </section>
        )}

        <section aria-label="Remedy">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-ash">Remedy</h3>
          {ex.remedy.action === "archive" ? (
            <pre className="overflow-x-auto rounded-xl border border-seam bg-ink p-3 font-mono text-[12px] leading-relaxed text-bone-dim">
              {`|archive-url=${ex.remedy.archiveUrl}\n|archive-date=${ex.remedy.archiveDate}\n|url-status=${ex.remedy.urlStatus}`}
            </pre>
          ) : (
            <p className="text-sm text-bone-dim">{ex.remedy.note ?? (ex.verdict === "alive" ? "Nothing to do." : "Needs a person.")}</p>
          )}
          {ex.remedy.action === "archive" && ex.remedy.note && <p className="mt-2 text-xs text-ash">{ex.remedy.note}</p>}
        </section>
      </div>
    </article>
  );
}
