/**
 * Benchmark Revenant against labels Wikipedia editors already wrote by hand.
 *
 *   npm run benchmark -- --positives 60 --controls 60
 *
 * Positives: citations editors marked `url-status=usurped` (the domain was
 * taken over). Revenant never sees that label: it gets only the URL, title,
 * citing sentence and access date, exactly like an untagged citation.
 *
 * Controls: citations marked `url-status=live` in the same articles. Editors
 * set that label when they added an archive copy, sometimes years ago, so a
 * "possessed" verdict on a control is either a false positive or a takeover
 * nobody has tagged yet. The script records the evidence so a person can tell.
 *
 * Runs with the lexical claim check (no LLM) so results are reproducible and
 * free. Writes benchmark/results-seed<seed>.json and prints a summary.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { extractWikitext } from "../src/core/extract/wikitext";
import { mapPool } from "../src/core/net/limiter";
import { safeFetch } from "../src/core/net/fetch";
import { examineLink } from "../src/core/server";
import type { ExtractedLink, Verdict } from "../src/core/types";
import { isStableResolver } from "../src/core/url";

process.env.REVENANT_LLM = "off";

const args = process.argv.slice(2);
const arg = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const POSITIVES = arg("positives", 60);
const CONTROLS = arg("controls", 60);
const SEED = arg("seed", 2026);
const UA = "RevenantBot/0.1 (https://github.com/ZNLong2203/revenant; benchmark)";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const rand = rng(SEED);

async function wiki<T>(params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const r = await safeFetch(`https://en.wikipedia.org/w/api.php?${q}`, {
    trusted: true,
    timeoutMs: 20_000,
    maxBytes: 8_000_000,
    headers: { "user-agent": UA },
  });
  return JSON.parse(r.body) as T;
}

async function sampleTitles(n: number): Promise<string[]> {
  const titles = new Set<string>();
  // spread the sample across the result list instead of taking the top hits
  const offsets = Array.from({ length: Math.ceil(n / 10) }, () => Math.floor(rand() * 9000));
  for (const offset of offsets) {
    const d = await wiki<{ query: { search: { title: string }[] } }>({
      action: "query",
      list: "search",
      srsearch: 'insource:"url-status=usurped"',
      srlimit: "10",
      sroffset: String(offset),
      srnamespace: "0",
    });
    for (const s of d.query.search) titles.add(s.title);
  }
  return [...titles];
}

async function wikitext(title: string): Promise<string | undefined> {
  const d = await wiki<{ query: { pages: { revisions?: { slots: { main: { content: string } } }[] }[] } }>({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
  });
  return d.query.pages[0]?.revisions?.[0]?.slots.main.content;
}

interface Row {
  set: "positive" | "control";
  article: string;
  url: string;
  accessDate?: string;
  verdict: Verdict;
  confidence: number;
  signals: string[];
  summary: string;
  liveTitle?: string;
  finalUrl?: string;
  registeredAt?: string;
  archiveDate?: string;
  ms: number;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

async function main() {
  console.log(`Sampling articles with usurped citations (seed ${SEED})...`);
  const titles = await sampleTitles(Math.max(POSITIVES, CONTROLS) * 2);
  const positives: { article: string; link: ExtractedLink }[] = [];
  const controls: { article: string; link: ExtractedLink }[] = [];
  for (const title of titles) {
    if (positives.length >= POSITIVES && controls.length >= CONTROLS) break;
    const text = await wikitext(title).catch(() => undefined);
    if (!text) continue;
    const links = extractWikitext(text).filter((l) => !isStableResolver(l.url));
    const usurped = links.filter((l) => l.existingStatus === "usurped");
    const live = links.filter((l) => l.existingStatus === "live");
    if (usurped.length && positives.length < POSITIVES) positives.push({ article: title, link: pick(usurped) });
    if (live.length && controls.length < CONTROLS) controls.push({ article: title, link: pick(live) });
  }
  console.log(`${positives.length} positives, ${controls.length} controls from ${titles.length} articles`);

  const jobs = [
    ...positives.map((p) => ({ ...p, set: "positive" as const })),
    ...controls.map((c) => ({ ...c, set: "control" as const })),
  ];
  let done = 0;
  const rows = await mapPool(jobs, 4, async ({ article, link, set }): Promise<Row> => {
    // label-blind: no existing status, no existing archive
    const ex = await examineLink({ linkId: link.id, url: link.url, title: link.title, context: link.context, accessDate: link.accessDate });
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${jobs.length}`);
    return {
      set,
      article,
      url: link.url,
      accessDate: link.accessDate,
      verdict: ex.verdict,
      confidence: ex.confidence,
      signals: ex.evidence.filter((e) => e.points === ex.verdict).map((e) => e.signal),
      summary: ex.summary,
      liveTitle: ex.live?.title?.slice(0, 120),
      finalUrl: ex.live?.finalUrl,
      registeredAt: ex.domain?.registeredAt,
      archiveDate: ex.remedy.archiveDate,
      ms: ex.durationMs,
    };
  });

  const tally = (set: Row["set"]) => {
    const r = rows.filter((x) => x.set === set);
    const by: Record<string, number> = {};
    for (const x of r) by[x.verdict] = (by[x.verdict] ?? 0) + 1;
    return { n: r.length, by };
  };
  const pos = tally("positive");
  const ctl = tally("control");
  const decided = rows.filter((r) => r.set === "positive" && r.verdict !== "unknown");
  const caught = rows.filter((r) => r.set === "positive" && r.verdict === "possessed").length;
  const flaggedProblem = rows.filter((r) => r.set === "positive" && r.verdict !== "alive" && r.verdict !== "unknown").length;
  const summary = {
    ranAt: new Date().toISOString(),
    seed: SEED,
    claimCheck: "lexical",
    positives: pos,
    controls: ctl,
    recallPossessed: pos.n ? caught / pos.n : 0,
    recallPossessedOfDecided: decided.length ? caught / decided.length : 0,
    recallAnyProblem: pos.n ? flaggedProblem / pos.n : 0,
    controlPossessedRate: ctl.n ? (ctl.by.possessed ?? 0) / ctl.n : 0,
    remedyWithArchive: rows.filter((r) => r.set === "positive" && r.verdict === "possessed" && r.archiveDate).length,
    medianMs: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0,
  };
  await mkdir("benchmark", { recursive: true });
  await writeFile(`benchmark/results-seed${SEED}.json`, `${JSON.stringify({ summary, rows }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
