/**
 * Publish a finished census.
 *
 *   npm run census -- "Category:PHP" --limit 50          # run it first (CLI), note the run id
 *   npm run census:publish -- <run id>
 *
 * Writes census/<id>.csv and census/<id>.wiki.txt (the worklist, committed so
 * anyone can check the rows) and adds the run's totals, with the date, to
 * src/data/census.json for the home page. Publishing a run again replaces its
 * entry. Refuses a run that has not finished, so a published number always
 * counts every article it says it counted.
 *
 * If census/<id>.checks.json exists, it lists untagged possessed URLs someone
 * opened on the live web: [{ "url", "outcome": "confirmed" | "not-confirmed", "note" }].
 * The totals then say how many rows were checked and how many were confirmed.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildReport, toCsv, toWikitext } from "../src/core/census/report";
import { loadRun } from "../src/core/census/store";
import type { CensusSummary } from "../src/data/census";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: npm run census:publish -- <run id>   (ids are the file names in .revenant/census/)");
    process.exit(2);
  }
  const run = await loadRun(id);
  if (!run.finishedAt) {
    console.error(`${id} has finished ${run.done} of ${run.articles.length} articles. Continue it first: npx tsx bin/revenant.ts census --resume ${id}`);
    process.exit(1);
  }
  const report = buildReport(run);
  const { totals: t, meta } = report;
  const scope = meta.source.kind === "category" ? `Category:${meta.source.value}` : meta.source.kind === "domain" ? `links to ${meta.source.value}` : meta.source.value;

  await mkdir("census", { recursive: true });
  await writeFile(`census/${id}.csv`, toCsv([...report.worklist, ...report.review]));
  await writeFile(`census/${id}.wiki.txt`, toWikitext(report));

  // hand checks, if any: counted per row, so a URL cited twice counts twice
  let checked: CensusSummary["checked"];
  const checksRaw = await readFile(`census/${id}.checks.json`, "utf8").catch(() => undefined);
  if (checksRaw) {
    const checks = JSON.parse(checksRaw) as { checkedOn: string; urls: { url: string; outcome: "confirmed" | "not-confirmed"; note?: string }[] };
    const outcome = new Map(checks.urls.map((c) => [c.url, c.outcome]));
    const untagged = [...report.worklist, ...report.review].filter((r) => r.verdict === "possessed");
    const missing = untagged.filter((r) => !outcome.has(r.url));
    if (missing.length) {
      console.error(`census/${id}.checks.json has no entry for ${[...new Set(missing.map((r) => r.url))].join(", ")}`);
      process.exit(1);
    }
    checked = { on: checks.checkedOn, rows: untagged.length, confirmed: untagged.filter((r) => outcome.get(r.url) === "confirmed").length };
  }

  const summary: CensusSummary = {
    runId: id,
    scope,
    lang: meta.source.lang,
    measuredOn: run.finishedAt.slice(0, 10),
    version: run.version,
    articles: t.articlesDone,
    moreArticles: meta.moreArticles,
    citations: t.citations,
    urls: t.urls,
    counts: t.counts,
    untaggedPossessed: t.untaggedPossessed,
    taggedPossessed: t.taggedPossessed,
    worklist: t.worklist,
    review: t.review,
    ...(checked ? { checked } : {}),
    shareAffected: t.shareAffected,
    notChecked: t.notChecked,
    articleErrors: t.articleErrors,
  };
  const published = JSON.parse(await readFile("src/data/census.json", "utf8").catch(() => "[]")) as CensusSummary[];
  const at = published.findIndex((c) => c.runId === id);
  if (at >= 0) published[at] = summary;
  else published.push(summary);
  await writeFile("src/data/census.json", `${JSON.stringify(published, null, 2)}\n`);
  console.log(`${scope}: ${t.articlesDone} articles, ${t.citations} citations, ${t.untaggedPossessed} untagged possessed, ${t.worklist} on the worklist, ${t.review} to review`);
  console.log(`wrote census/${id}.csv, census/${id}.wiki.txt and src/data/census.json`);
}

void main();
