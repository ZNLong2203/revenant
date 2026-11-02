/**
 * Record featured scans for the home page.
 *
 *   npm run featured                 # all sources below
 *   npm run featured -- php stirling # only these slugs
 *
 * Writes public/featured/<slug>.json (document + every examination) and
 * src/data/featured.json (the index the home page reads). Recorded scans
 * open instantly and keep the demo working when the archive is slow.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { examine } from "../src/core/examine";
import { cdxPaused, findArchive } from "../src/core/net/sources";
import { scanDocument } from "../src/core/scan";
import { liveDeps } from "../src/core/server";
import { loadDocument, parseInput } from "../src/core/sources";
import type { Verdict } from "../src/core/types";

const SOURCES = [
  { slug: "php", input: "https://en.wikipedia.org/wiki/PHP", kind: "Wikipedia", note: "The language's own article: a Microsoft developer page it cites now sells lottery tickets." },
  {
    slug: "supreme-court-demographics",
    input: "https://en.wikipedia.org/wiki/Demographics_of_the_Supreme_Court_of_the_United_States",
    kind: "Wikipedia",
    note: "Religious statistics cited from adherents.com, a domain that now serves a Thai online casino.",
  },
  { slug: "stirling-engine", input: "https://en.wikipedia.org/wiki/Stirling_engine", kind: "Wikipedia", note: "Engineering references, one of them now a domain-for-sale page." },
];

async function main() {
  const only = process.argv.slice(2);
  const indexPath = "src/data/featured.json";
  const index: Record<string, unknown>[] = JSON.parse(await readFile(indexPath, "utf8").catch(() => "[]"));
  await mkdir("public/featured", { recursive: true });

  for (const src of SOURCES.filter((s) => !only.length || only.includes(s.slug))) {
    const t0 = Date.now();
    console.log(`scanning ${src.slug}…`);
    const doc = await loadDocument(parseInput(src.input));
    const scan = await scanDocument(doc, { concurrency: 2 });
    // second pass: problems that got no archived copy (usually a busy archive) are
    // examined again one at a time, bypassing the caches
    const retry = doc.links.filter((l) => {
      const ex = scan.results[l.id];
      return ex && ["possessed", "ghost", "buried", "changeling"].includes(ex.verdict) && !ex.remedy.archiveUrl;
    });
    let recovered = 0;
    for (const l of retry) {
      while (cdxPaused()) await new Promise((r) => setTimeout(r, 5000));
      const ex = await examine(
        { linkId: l.id, url: l.url, title: l.title, context: l.context, accessDate: l.accessDate, quote: l.quote },
        { ...liveDeps, archive: findArchive },
      );
      if (ex.remedy.archiveUrl) recovered++;
      scan.results[l.id] = ex;
    }
    if (retry.length) console.log(`  second pass: ${recovered} of ${retry.length} now have an archived copy`);
    scan.counts = Object.fromEntries(Object.keys(scan.counts).map((v) => [v, 0])) as typeof scan.counts;
    for (const l of doc.links) if (scan.results[l.id]) scan.counts[scan.results[l.id].verdict]++;
    const untagged = doc.links.filter((l) => scan.results[l.id]?.verdict === "possessed" && !["usurped", "unfit"].includes(l.existingStatus ?? "")).length;
    const counts = Object.fromEntries(Object.entries(scan.counts).filter(([, n]) => n > 0)) as Partial<Record<Verdict, number>>;
    const recordedOn = new Date().toISOString().slice(0, 10);
    await writeFile(
      `public/featured/${src.slug}.json`,
      JSON.stringify({
        doc: scan.doc,
        results: scan.results,
        recordedOn,
        license: doc.origin.type === "wikipedia" ? "Article text from Wikipedia, CC BY-SA 4.0" : undefined,
      }),
    );
    const entry = { slug: src.slug, kind: src.kind, title: doc.title, note: src.note, links: doc.links.length, counts, untaggedPossessed: untagged, recordedOn };
    const i = index.findIndex((e) => e.slug === src.slug);
    if (i >= 0) index[i] = entry;
    else index.push(entry);
    console.log(`  ${doc.links.length} links, ${JSON.stringify(counts)}, ${untagged} possessed not yet tagged, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  index.sort((a, b) => SOURCES.findIndex((s) => s.slug === a.slug) - SOURCES.findIndex((s) => s.slug === b.slug));
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
