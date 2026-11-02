import type { Metadata } from "next";
import Link from "next/link";
import { VERDICT_META } from "@/components/verdict";
import { BENCHMARK } from "@/data/benchmark";
import { FACTS } from "@/data/facts";

export const metadata: Metadata = { title: "Method" };

const SIGNALS: { signal: string; verdict: keyof typeof VERDICT_META; how: string }[] = [
  { signal: "DNS gone, 404, 410", verdict: "buried", how: "The live request fails outright." },
  { signal: "Parked or for sale", verdict: "possessed", how: "Redirect to a domain marketplace, or two or more parking phrases (\"this domain may be for sale\", \"Domain registered | Dynadot\")." },
  { signal: "Spam takeover", verdict: "possessed", how: "Gambling or spam vocabulary in English, Indonesian, Thai, Vietnamese, Chinese, Japanese or Korean that the archived copy did not have." },
  { signal: "New owner", verdict: "possessed", how: "RDAP says the domain's current registration began more than 45 days after the access date, and the page shares little with the archived copy." },
  { signal: "Gambling redirect", verdict: "possessed", how: "The link now redirects to a different domain whose name is a gambling domain, even if that server is down." },
  { signal: "Error title", verdict: "ghost", how: "200 OK, but the title says \"Page not found\" or similar." },
  { signal: "Redirect to home", verdict: "ghost", how: "A deep link quietly lands on the site's home page." },
  { signal: "Sibling probe", verdict: "ghost", how: "A made-up address next to the cited one returns the same page (only for pages with real server-rendered text)." },
  { signal: "Content replaced", verdict: "changeling", how: "The archived copy matched the cited title and the live page does not, or the claim check says the archive supports the sentence and the live page no longer does." },
  { signal: "Bot wall", verdict: "unknown", how: "401/402/403/429, a bot challenge, or two timeouts. Revenant never tries to get past these." },
];

export default function MethodPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-candle">Method</p>
      <h1 className="mt-3 font-display text-5xl text-bone">How Revenant decides</h1>
      <p className="mt-4 text-lg leading-relaxed text-bone-dim">
        For each link Revenant fetches the live page as an honest bot, looks up the domain&apos;s registration in RDAP, and, when anything looks off, finds the
        Wayback Machine capture closest to the date the author read the page. A pure decision function weighs the evidence, so every verdict comes with the
        sentences that justify it.
      </p>

      <h2 className="mt-14 font-display text-3xl text-bone">Signals</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border border-seam">
        <table className="w-full text-left text-sm">
          <thead className="bg-vault/70 text-xs uppercase tracking-wider text-ash">
            <tr>
              <th className="p-3">Signal</th>
              <th className="p-3">Points to</th>
              <th className="hidden p-3 sm:table-cell">How it is measured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-seam">
            {SIGNALS.map((s) => (
              <tr key={s.signal} className="align-top">
                <td className="p-3 text-bone">
                  {s.signal}
                  <p className="mt-1 text-bone-dim sm:hidden">{s.how}</p>
                </td>
                <td className={`p-3 ${VERDICT_META[s.verdict].text}`}>
                  {VERDICT_META[s.verdict].glyph} {VERDICT_META[s.verdict].label}
                </td>
                <td className="hidden p-3 text-bone-dim sm:table-cell">{s.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 font-display text-3xl text-bone">Raising the dead</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-bone-dim">
        <li>Captures must be HTTP 200 HTML, PDF or text, and are ranked by distance to the access date.</li>
        <li>
          <span className="text-bone">Never after the takeover.</span> The archive keeps crawling usurped domains, so the newest copy of a possessed link is usually a
          copy of the squatter. Captures on or after the new registration date are excluded, captures that are themselves spam are skipped, and if every nearby
          capture is spam Revenant searches three years further back.
        </li>
        <li>
          The chosen copy is checked against the citing sentence: by Claude with a fixed JSON schema when an API key is configured, by word overlap otherwise. Page
          text is passed as untrusted data, and quotes are kept only if they appear verbatim in the archived text.
        </li>
        <li>
          The fix uses Wikipedia&apos;s own vocabulary: <span className="font-mono text-bone">archive-url</span>, <span className="font-mono text-bone">archive-date</span>{" "}
          (in the citation&apos;s date style) and <span className="font-mono text-bone">url-status</span>. Every other byte of the article is left alone, which 23
          property-based tests check on generated citations.
        </li>
      </ul>

      <h2 id="benchmark" className="mt-14 scroll-mt-24 font-display text-3xl text-bone">
        Benchmark
      </h2>
      <p className="mt-4 text-bone-dim">
        Wikipedia editors have already tagged some citations by hand. That is ground truth Revenant can be measured against without ever seeing it.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-bone-dim">
        <li>
          <span className="text-bone">Positives:</span> {BENCHMARK.positives} citations tagged <span className="font-mono">url-status=usurped</span>, sampled at random
          from articles across English Wikipedia.
        </li>
        <li>
          <span className="text-bone">Controls:</span> {BENCHMARK.controls} citations tagged <span className="font-mono">url-status=live</span> from the same articles.
        </li>
        <li>Revenant gets only the URL, title, citing sentence and access date: never the tag, never the existing archive link.</li>
        <li>
          Seeds 2026, 1031 and 3110 were used to find and fix mistakes, so they are development data. The numbers below come from seed {BENCHMARK.seed}, run once
          after the last change on {BENCHMARK.ranOn}.
        </li>
      </ul>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-seam bg-crypt/60 p-5">
          <p className="font-display text-4xl text-candle">{BENCHMARK.flaggedOfDecidedPct}</p>
          <p className="mt-1 text-sm text-bone-dim">
            of usurped-tagged citations Revenant could judge were flagged as a problem ({BENCHMARK.flagged} of {BENCHMARK.decided}).
          </p>
        </div>
        <div className="rounded-2xl border border-seam bg-crypt/60 p-5">
          <p className="font-display text-4xl text-alive">{BENCHMARK.controlPossessed}</p>
          <p className="mt-1 text-sm text-bone-dim">
            of {BENCHMARK.controls} live-tagged citations were called possessed, the verdict that hides a link.
          </p>
        </div>
        <div className="rounded-2xl border border-seam bg-crypt/60 p-5">
          <p className="font-display text-4xl text-unknown">{BENCHMARK.unknownPositives}</p>
          <p className="mt-1 text-sm text-bone-dim">usurped-tagged citations were unknown, almost all bot walls. Revenant leaves those to a person.</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-bone-dim">{BENCHMARK.notes}</p>
      <p className="mt-2 text-sm">
        <a className="text-candle underline underline-offset-4" href="https://github.com/ZNLong2203/revenant/tree/main/benchmark" target="_blank" rel="noreferrer">
          Every row is published
        </a>{" "}
        with its verdict, signals and the live page title, and <span className="font-mono">npm run benchmark -- --seed &lt;n&gt;</span> reproduces a run.
      </p>

      <h2 className="mt-14 font-display text-3xl text-bone">Limits</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-bone-dim">
        <li>Sites behind bot checks are reported as unknown; that is the price of not pretending to be a browser.</li>
        <li>Some country-code domains publish no RDAP data, so takeovers there are found only from content.</li>
        <li>A domain that changed hands between two legitimate owners can look like a takeover; the content comparison usually tells them apart, but not always.</li>
        <li>The Wayback Machine is a shared public resource. Revenant limits itself to three concurrent requests, retries politely and caches captures for 30 days.</li>
        <li>Revenant proposes patches. It never edits Wikipedia, GitHub or anything else.</li>
      </ul>

      <p className="mt-14 text-sm text-ash">
        Wikipedia figures on the home page were measured on {FACTS.measuredOn}.{" "}
        <Link href="/agents" className="text-candle underline underline-offset-4">
          Use Revenant from your agent →
        </Link>
      </p>
    </article>
  );
}
