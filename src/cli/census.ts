/**
 * `revenant census`: scan a set of Wikipedia articles and list the possessed
 * citations nobody has tagged. Progress is saved after every article, so a
 * stopped run continues with --resume.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { buildReport, sourceNote, toCsv, toWikitext, type CensusReport } from "../core/census/report";
import { createRun, type CensusOutcome } from "../core/census/run";
import { runLiveCensus } from "../core/census/server";
import { loadRun, saveRun } from "../core/census/store";
import { isLang, parseCensusSource, parseTitleList, resolveTargets, type ParsedTarget } from "../core/census/targets";
import { DEFAULT_LIMIT, type CensusRun } from "../core/census/types";
import type { Verdict } from "../core/types";

export interface CensusCliOptions {
  /** A category, `domain:example.com`, or the path of a file with one title per line. */
  target?: string;
  /** Id of a saved run to continue. */
  resume?: string;
  limit?: number;
  lang?: string;
  maxLinks?: number;
  csv?: string;
  wikitext?: string;
  json?: boolean;
}

const GLYPH: Record<Verdict, string> = { possessed: "☠", changeling: "◐", ghost: "◌", buried: "✝", unknown: "?", alive: "✓" };
const nf = new Intl.NumberFormat("en-US");

async function targetFrom(raw: string, lang: string): Promise<ParsedTarget> {
  const file = await stat(raw).catch(() => undefined);
  if (!file?.isFile()) return parseCensusSource(raw, lang);
  const titles = parseTitleList(await readFile(raw, "utf8"));
  if (!titles.length) throw new Error(`${raw} has no article titles.`);
  return { source: { kind: "titles", value: basename(raw), lang }, titles };
}

function summary(report: CensusReport): string[] {
  const { totals: t, meta } = report;
  const scope = meta.source.kind === "category" ? `Category:${meta.source.value}` : meta.source.kind === "domain" ? `links to ${meta.source.value}` : meta.source.value;
  const verdicts = (Object.keys(t.counts) as Verdict[]).filter((v) => t.counts[v]).map((v) => `${GLYPH[v]} ${nf.format(t.counts[v])} ${v}`);
  const lines = [
    `Census of ${scope} (${meta.source.lang}.wikipedia.org), ${meta.createdAt.slice(0, 10)}, Revenant ${meta.version}`,
    `  ${nf.format(t.articlesDone)} of ${nf.format(t.articles)} articles · ${nf.format(t.citations)} citations · ${nf.format(t.urls)} distinct URLs examined`,
    `  ${verdicts.join(" · ") || "nothing examined yet"}`,
    `  untagged possessed: ${nf.format(t.untaggedPossessed)} (${(t.shareAffected * 100).toFixed(2)}% of citations) · already tagged by editors: ${nf.format(t.taggedPossessed)}`,
    `  worklist: ${nf.format(t.worklist)} · needs a closer look: ${nf.format(t.review)}`,
  ];
  if (t.notChecked) lines.push(`  ${nf.format(t.notChecked)} links were not checked (per-article limit)`);
  if (t.articleErrors) lines.push(`  ${t.articleErrors} article(s) could not be loaded`);
  if (meta.moreArticles) lines.push("  the source has more articles than the limit; raise --limit to count them");
  return lines;
}

function printRows(report: CensusReport, max = 15) {
  const rows = [...report.worklist, ...report.review].slice(0, max);
  if (!rows.length) return;
  console.log("");
  for (const r of rows) {
    console.log(`  ${GLYPH[r.verdict]} ${r.verdict.padEnd(10)} ${r.article}`);
    console.log(`               ${r.url}`);
    if (r.claim) console.log(`               cited for: ${r.claim.length > 110 ? `${r.claim.slice(0, 109)}…` : r.claim}`);
    for (const e of r.evidence) console.log(`               - ${e}`);
    console.log(`               ${r.fix ? `fix: ${r.fix}` : "no fix: no archived copy was found"}${sourceNote(r) ? ` (${sourceNote(r)})` : ""}`);
  }
  const rest = report.worklist.length + report.review.length - rows.length;
  if (rest > 0) console.log(`\n  … and ${rest} more. Use --csv or --wikitext to get all of them.`);
}

/** Returns the exit code: 0 finished, 3 stopped before the end (paused or interrupted). Throws on bad input. */
export async function censusCommand(opts: CensusCliOptions): Promise<number> {
  const lang = (opts.lang ?? "en").toLowerCase();
  if (!isLang(lang)) throw new Error(`"${lang}" is not a Wikipedia language code.`);
  const limit = opts.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a whole number of at least 1.");
  if (opts.maxLinks !== undefined && (!Number.isInteger(opts.maxLinks) || opts.maxLinks < 1)) throw new Error("--max-links must be a whole number of at least 1.");

  let run: CensusRun;
  if (opts.resume) {
    run = await loadRun(opts.resume);
    console.log(`Resuming ${run.id}: ${run.done} of ${run.articles.length} articles already done.`);
  } else {
    if (!opts.target) throw new Error("Give a category, domain:example.com, or a file of article titles. See `revenant census` in the README.");
    const target = await targetFrom(opts.target, lang);
    console.log(`Looking up articles for ${target.source.kind} ${target.source.value}…`);
    const { articles, more } = await resolveTargets(target, limit);
    run = createRun(target.source, articles, { moreArticles: more });
    console.log(`${articles.length} articles${more ? ` (the source has more; limit is ${limit})` : ""}. Run id: ${run.id}`);
  }
  const file = await saveRun(run);

  const controller = new AbortController();
  const onSigint = () => {
    if (controller.signal.aborted) process.exit(130);
    console.error("\nStopping. The article in progress is not recorded and will be redone on resume. Press Ctrl-C again to quit now.");
    controller.abort();
  };
  process.on("SIGINT", onSigint);

  const tty = process.stderr.isTTY;
  let outcome: CensusOutcome;
  try {
    outcome = await runLiveCensus(run, {
      signal: controller.signal,
      maxLinks: opts.maxLinks,
      concurrency: 4,
      save: async (r) => {
        await saveRun(r);
        if (tty) process.stderr.write("\r\x1b[K");
        const found = r.rows.filter((x) => !x.tagged).length;
        console.log(`  [${r.done}/${r.articles.length}] ${r.articles[r.done - 1] ?? ""}  ·  ${nf.format(r.seenUrls.length)} URLs, ${found} found so far`);
      },
      onProgress: (p) => {
        if (tty && p.urls) process.stderr.write(`\r\x1b[K  ${p.article}: ${p.examined}/${p.urls} new URLs`);
      },
    });
  } finally {
    process.off("SIGINT", onSigint);
    if (tty) process.stderr.write("\r\x1b[K");
  }

  const report = buildReport(run);
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("");
    for (const line of summary(report)) console.log(line);
    printRows(report);
  }
  if (opts.csv) {
    await writeFile(opts.csv, toCsv([...report.worklist, ...report.review]));
    console.log(`\nCSV written to ${opts.csv}`);
  }
  if (opts.wikitext) {
    await writeFile(opts.wikitext, toWikitext(report));
    console.log(`Wikitext table written to ${opts.wikitext}`);
  }

  if (outcome.stop !== "finished") {
    console.log(
      `\nStopped after ${run.done} of ${run.articles.length} articles${outcome.reason ? ` (${outcome.reason})` : outcome.stop === "aborted" ? " (interrupted)" : ""}.\n` +
        `Continue with: npx tsx bin/revenant.ts census --resume ${run.id}`,
    );
    return 3;
  }
  console.log(`\nSaved: ${file}`);
  return 0;
}
