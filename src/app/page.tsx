import Link from "next/link";
import { REPO_URL } from "@/components/site";
import { SummonForm } from "@/components/summon-form";
import { Tombstone, VERDICT_META, VerdictBadge } from "@/components/verdict";
import type { Verdict } from "@/core/types";
import { BENCHMARK } from "@/data/benchmark";
import { CENSUS } from "@/data/census";
import { EXHIBIT, FACTS } from "@/data/facts";
import { FEATURED } from "@/data/featured";

const nf = new Intl.NumberFormat("en-US");
const ORDER: Verdict[] = ["possessed", "changeling", "ghost", "buried", "alive"];

export default function Home() {
  return (
    <div>
      {/* ---- hero ----------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="text-xs uppercase tracking-[0.25em] text-candle">Link rot that status codes miss</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.02] text-bone sm:text-7xl">
            Some links come back <em className="text-possessed">wrong</em>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone-dim">
            A cited domain expires. A squatter buys it. The link still answers <span className="font-mono text-bone">200 OK</span>, so every dead-link checker calls it
            alive, and readers land on a casino. Revenant finds those links, along with soft 404s and rewritten pages. It raises the original from the Internet Archive
            and checks it against the sentence that cites it.
          </p>
          <div className="mt-10 max-w-3xl">
            <SummonForm />
          </div>
        </div>
      </section>

      {/* ---- exhibit: then / now -------------------------------------------- */}
      <section aria-labelledby="exhibit" className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-seam bg-crypt/70 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <VerdictBadge verdict="possessed" size="md" />
            <h2 id="exhibit" className="font-display text-2xl text-bone sm:text-3xl">
              Exhibit A: Wikipedia&apos;s <a className="underline decoration-seam-strong underline-offset-4 hover:text-candle" href={EXHIBIT.articleUrl}>PHP</a> article
            </h2>
          </div>
          <blockquote className="mt-4 font-display text-xl italic text-bone-dim">“{EXHIBIT.claim}”</blockquote>
          <p className="mt-1 break-all font-mono text-xs text-ash">{EXHIBIT.url}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <div className="rounded-2xl border border-candle/30 bg-vault/60 p-5">
              <p className="text-xs uppercase tracking-wider text-candle">Then · archived {EXHIBIT.then.date}</p>
              <p className="mt-3 text-lg font-medium text-bone">{EXHIBIT.then.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-bone-dim">{EXHIBIT.then.excerpt}</p>
              <a className="mt-3 inline-block text-xs text-candle underline underline-offset-4" href={EXHIBIT.then.archiveUrl} target="_blank" rel="noreferrer">
                Wayback Machine copy ↗
              </a>
            </div>
            <div className="flex flex-row items-center justify-center gap-3 text-center text-xs text-ash md:flex-col">
              <span className="font-mono">cited {EXHIBIT.accessDate}</span>
              <span aria-hidden="true" className="text-possessed">→</span>
              <span className="rounded-full border border-possessed/40 px-2 py-1 font-mono text-possessed">re-registered {EXHIBIT.registeredAt}</span>
              <span aria-hidden="true" className="text-possessed">→</span>
              <span className="font-mono">today</span>
            </div>
            <div className="rounded-2xl border border-possessed/30 bg-possessed/5 p-5">
              <p className="text-xs uppercase tracking-wider text-possessed">
                Now · <span className="font-mono">{EXHIBIT.now.status} OK</span>
              </p>
              <p className="mt-3 text-lg font-medium text-bone">{EXHIBIT.now.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-bone-dim">{EXHIBIT.now.excerpt}</p>
              <p className="mt-3 font-mono text-xs text-ash">{EXHIBIT.now.finalUrl}</p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-sm text-bone-dim">
            Revenant reached this verdict in about three seconds, without reading the label an editor had added by hand. The domain&apos;s RDAP record shows a new
            registration after the citation date, the page now carries gambling terms the archive never had, and the deep link redirects to the home page. It picked the
            same 2014 snapshot the editor chose.{" "}
            <Link href="/scan?q=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FPHP" className="text-candle underline underline-offset-4">
              Scan the whole article →
            </Link>
          </p>
        </div>
      </section>

      {/* ---- the five states ------------------------------------------------ */}
      <section aria-labelledby="states" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 id="states" className="font-display text-4xl text-bone">
          Five ways a link can be
        </h2>
        <p className="mt-3 max-w-2xl text-bone-dim">
          Each verdict maps onto a value of Wikipedia&apos;s <span className="font-mono text-bone">url-status</span> parameter, so a fix can be written straight back
          into the citation.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ORDER.map((v) => {
            const m = VERDICT_META[v];
            return (
              <div key={v} className="rounded-2xl border border-seam bg-crypt/60 p-5">
                <Tombstone verdict={v} size={28} />
                <h3 className={`mt-3 font-display text-2xl ${m.text}`}>{m.label}</h3>
                <p className="mt-1 font-mono text-xs text-ash">url-status={m.status}</p>
                <p className="mt-3 text-sm leading-relaxed text-bone-dim">{m.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- numbers -------------------------------------------------------- */}
      <section aria-labelledby="numbers" className="border-y border-seam bg-crypt/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          <h2 id="numbers" className="sr-only">
            The size of the problem
          </h2>
          <div>
            <p className="font-display text-5xl text-possessed">{nf.format(FACTS.articlesWithUsurped)}</p>
            <p className="mt-2 text-sm text-bone-dim">
              English Wikipedia articles where editors have already flagged at least one citation as <span className="font-mono">usurped</span> by hand. Revenant finds the
              ones nobody has flagged yet.
            </p>
          </div>
          <div>
            <p className="font-display text-5xl text-bone">{nf.format(FACTS.articlesWithDead)}</p>
            <p className="mt-2 text-sm text-bone-dim">
              articles with at least one citation marked <span className="font-mono">dead</span>. Each one needs an archived copy that actually supports the sentence.
            </p>
          </div>
          <div>
            <p className="font-display text-5xl text-candle">{BENCHMARK.headline}</p>
            <p className="mt-2 text-sm text-bone-dim">{BENCHMARK.caption}</p>
            <Link href="/method#benchmark" className="mt-2 inline-block text-xs text-candle underline underline-offset-4">
              How we measured
            </Link>
          </div>
          <p className="text-xs text-ash md:col-span-3">Wikipedia counts measured with the search API on {FACTS.measuredOn}.</p>
        </div>
      </section>

      {/* ---- census: only once a finished run has been published ------------ */}
      {CENSUS.length > 0 && (
        <section aria-labelledby="census" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="census" className="font-display text-4xl text-bone">
            Graveyard census
          </h2>
          <p className="mt-3 max-w-3xl text-bone-dim">
            Revenant can scan a whole Wikipedia category and list the possessed citations that no editor has tagged <span className="font-mono text-bone">usurped</span> or{" "}
            <span className="font-mono text-bone">unfit</span>. These are the runs published so far. Each covers the articles it names, not Wikipedia as a whole.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {CENSUS.map((c) => (
              <article key={c.runId} className="rounded-2xl border border-seam bg-crypt/60 p-5 sm:p-6">
                <h3 className="font-mono text-sm text-bone">{c.scope}</h3>
                <p className="mt-1 text-xs text-ash">
                  {c.measuredOn} · {c.moreArticles ? `first ${nf.format(c.articles)} articles of a larger category` : `${nf.format(c.articles)} articles`} · {nf.format(c.citations)} citations ·{" "}
                  {nf.format(c.urls)} distinct links examined once each
                </p>
                <p className="mt-4 text-5xl font-semibold tabular-nums text-possessed">{nf.format(c.untaggedPossessed)}</p>
                <p className="mt-1 text-sm text-bone-dim">
                  possessed citations nobody has tagged ({(c.shareAffected * 100).toFixed(2)}% of the citations)
                </p>
                {c.checked && (
                  <p className="mt-3 text-sm text-bone-dim">
                    <span className="text-bone">{nf.format(c.checked.confirmed)} of {nf.format(c.checked.rows)}</span> were opened and read on {c.checked.on}: the address now
                    belongs to someone else. The rest could not be confirmed from the live page.
                  </p>
                )}
                <p className="mt-3 text-sm text-bone-dim">
                  {nf.format(c.taggedPossessed)} more {c.taggedPossessed === 1 ? "was" : "were"} already tagged by editors and found again without being told.
                </p>
                <a href={`${REPO_URL}/blob/main/census/${c.runId}.csv`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-candle underline underline-offset-4">
                  Every row, with its evidence (CSV) ↗
                </a>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm">
            <Link href="/census" className="text-candle underline underline-offset-4">
              Run a census of your own →
            </Link>
            <a href={`${REPO_URL}/blob/main/docs/CENSUS.md`} target="_blank" rel="noreferrer" className="ml-4 text-xs text-ash underline decoration-seam-strong underline-offset-4 hover:text-bone">
              Method and caveats ↗
            </a>
          </p>
        </section>
      )}

      {/* ---- featured ------------------------------------------------------- */}
      {FEATURED.length > 0 && (
        <section aria-labelledby="featured" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="featured" className="font-display text-4xl text-bone">
            Recent exhumations
          </h2>
          <p className="mt-2 text-bone-dim">Recorded scans. They open instantly, with every verdict and the patch.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {FEATURED.map((f) => (
              <Link key={f.slug} href={`/scan?featured=${f.slug}`} className="group rounded-2xl border border-seam bg-crypt/60 p-5 transition hover:border-candle/60">
                <p className="text-xs uppercase tracking-wider text-ash">{f.kind}</p>
                <h3 className="mt-2 font-display text-2xl text-bone group-hover:text-candle">{f.title}</h3>
                <p className="mt-2 text-sm text-bone-dim">{f.note}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ORDER.filter((v) => v !== "alive" && f.counts[v]).map((v) => (
                    <span key={v} className={`text-xs ${VERDICT_META[v].text}`}>
                      {VERDICT_META[v].glyph} {f.counts[v]} {VERDICT_META[v].label.toLowerCase()}
                    </span>
                  ))}
                  <span className="text-xs text-ash">of {f.links} links</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- where it runs -------------------------------------------------- */}
      <section aria-labelledby="where" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid gap-6 rounded-3xl border border-seam bg-gradient-to-br from-vault/80 to-crypt p-6 sm:p-10 md:grid-cols-2">
          <div>
            <h2 id="where" className="font-display text-4xl text-bone">
              Bring it to where you write
            </h2>
            <p className="mt-3 text-bone-dim">
              The same engine runs as a remote MCP server, a Kiro Power, a CLI, an agent hook that checks Markdown as your agent writes it, and a GitHub Action that fails a
              pull request when it adds a possessed link.
            </p>
            <Link href="/agents" className="mt-5 inline-block rounded-xl border border-candle/60 px-5 py-2.5 text-sm text-bone hover:bg-candle/10">
              Set it up for your agent →
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-seam bg-ink p-4 font-mono text-[12px] leading-relaxed text-bone-dim">{`$ npx tsx bin/revenant.ts scan sample.md
sample.md  (markdown, 2 links)
  ☠ possessed   https://www.interoperabilitybridges.com/
                projects/php-sdk-for-windows-azure.aspx
               The page is now full of online-gambling
               terms ("casino", "slot gacor", "toto").
  1 possessed · 1 alive
$ echo $?
1`}</pre>
        </div>
      </section>
    </div>
  );
}
