/** Spec: .kiro/specs/graveyard-census, Requirements 2 to 4. Pretend articles and a pretend examine step; no network. */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReport, parseCsv, toCsv, toWikitext } from "../../src/core/census/report";
import { CensusPaused, claimOf, createRun, runCensus, supportingEvidence, type CensusDeps } from "../../src/core/census/run";
import { loadRun, saveRun } from "../../src/core/census/store";
import { parseCensusRun, type CensusRun } from "../../src/core/census/types";
import type { Examination, ExamineRequest, SourceDocument } from "../../src/core/types";
import { article, fakeExamination, urlOf } from "../helpers/census-fixtures";

const NOW = new Date("2026-11-03T00:00:00Z");

function census(docs: SourceDocument[], overrides: Partial<CensusDeps> = {}) {
  const byTitle = new Map(docs.map((d) => [d.title, d]));
  const calls: string[] = [];
  const run = createRun({ kind: "category", value: "Test", lang: "en" }, docs.map((d) => d.title), { now: NOW });
  const deps: CensusDeps = {
    load: async (title) => {
      const d = byTitle.get(title);
      if (!d) throw new Error(`No Wikipedia article called "${title}"`);
      return d;
    },
    examine: async (req: ExamineRequest) => {
      calls.push(req.url);
      return fakeExamination(req);
    },
    now: () => NOW,
    ...overrides,
  };
  return { run, deps, calls };
}

describe("rows on the worklist", () => {
  it("writes the CS1 fix the way the patcher would, in the citation's own date style", async () => {
    const { run, deps } = census([article("PHP", [{ site: 0 }])]);
    await runCensus(run, deps);
    const [row] = run.rows;
    expect(row).toMatchObject({
      article: "PHP",
      url: urlOf(0),
      verdict: "possessed",
      tagged: false,
      needsNewSource: false,
      claim: expect.stringContaining("Sentence number 0"),
    });
    expect(row.fix).toBe(`archive-url=https://web.archive.org/web/20140320152702/${urlOf(0)} | archive-date=20 March 2014 | url-status=usurped`);
    // two independent signals: rdap and spam (spam-redirect is the same family as spam-terms)
    expect(row.evidence).toEqual(["spam-terms says possessed.", "rdap-reregistered says possessed."]);
  });

  it("does not list a citation an editor already tagged, but counts it", async () => {
    const { run, deps } = census([article("A", [{ site: 0, status: "usurped" }, { site: 5 }])]);
    await runCensus(run, deps);
    const report = buildReport(run);
    expect(run.rows.map((r) => r.tagged)).toEqual([true, false]);
    expect(report.worklist.map((r) => r.url)).toEqual([urlOf(5)]);
    expect(report.totals).toMatchObject({ untaggedPossessed: 1, taggedPossessed: 1, worklist: 1, review: 0 });
  });

  it("sends a verdict with one independent signal to the review list", async () => {
    const { run, deps } = census([article("A", [{ site: 1 }])]);
    await runCensus(run, deps);
    const report = buildReport(run);
    expect(report.worklist).toEqual([]);
    expect(report.review.map((r) => r.url)).toEqual([urlOf(1)]);
  });

  it("marks a citation that needs a new source when no archived copy was found or it does not support the sentence", async () => {
    const noCopy = (req: ExamineRequest): Examination => ({ ...fakeExamination(req), remedy: { action: "manual", urlStatus: "usurped", note: "No usable archived copy exists." } });
    const unsupported = (req: ExamineRequest): Examination => ({ ...fakeExamination(req), claim: { archive: "unsupported", method: "lexical", rationale: "no" } });
    for (const [pick, expectedFix] of [
      [noCopy, "url-status=usurped"],
      [unsupported, expect.stringContaining("archive-url=")],
    ] as const) {
      const { run, deps } = census([article("A", [{ site: 0 }])], { examine: async (req) => pick(req) });
      await runCensus(run, deps);
      expect(run.rows[0].needsNewSource).toBe(true);
      expect(run.rows[0].fix).toEqual(expectedFix);
    }
  });

  it("keeps the archive copy a citation already has when it predates the takeover", async () => {
    const doc = article("A", [{ site: 0 }]);
    doc.links[0].existingArchive = { url: "https://web.archive.org/web/20130101000000/http://x.org/", date: "2013-01-01" };
    const { run, deps } = census([doc]);
    await runCensus(run, deps);
    expect(run.rows[0].fix).toContain("archive-url=https://web.archive.org/web/20130101000000/http://x.org/");
  });
});

describe("what the worklist shows as the citing sentence", () => {
  it("shows the cited page's title when the citation sits in template text, not in a sentence", () => {
    for (const context of ["References {{Reflist|refs", "| released =", "| latest release version = Replaced by HHVM", "see [[PHP]] and", "<ref name=a>"]) {
      expect(claimOf({ context, title: "HipHop for PHP: Move Fast" })).toBe("Cited page: “HipHop for PHP: Move Fast”");
    }
    expect(claimOf({ context: "", title: undefined })).toBe("");
  });

  it("keeps a real sentence, even one with an equals sign or a colon", () => {
    const s = "The function returns x = 5 when the flag is set: see the manual.";
    expect(claimOf({ context: `  ${s}\n`, title: "Manual" })).toBe(s);
  });
});

describe("running politely and resumably", () => {
  it("lists a sentence that cites the same URL twice once", async () => {
    const doc = article("Twice", [{ site: 0 }]);
    // the same citation seen twice, e.g. a reference reused for the same sentence
    const { run, deps } = census([{ ...doc, links: [doc.links[0], { ...doc.links[0], id: "again" }] }]);
    await runCensus(run, deps);
    expect(run.citations).toBe(2);
    expect(run.rows).toHaveLength(1);
  });

  it("examines a URL once and gives its other citations their own rows", async () => {
    const { run, deps, calls } = census([article("One", [{ site: 0 }, { site: 3 }]), article("Two", [{ site: 0, status: "usurped" }])]);
    await runCensus(run, deps);
    expect(calls).toEqual([urlOf(0), urlOf(3)]);
    expect(run.rows.map((r) => [r.article, r.url, r.tagged])).toEqual([
      ["One", urlOf(0), false],
      ["Two", urlOf(0), true],
    ]);
    expect(run.citations).toBe(3);
    expect(run.counts).toMatchObject({ possessed: 1, alive: 1 });
    expect(run.seenUrls).toEqual([urlOf(0), urlOf(3)]);
  });

  it("records the start time, source, version and counts", async () => {
    const { run, deps } = census([article("A", [{ site: 2 }, { site: 4 }])]);
    await runCensus(run, deps);
    expect(run).toMatchObject({ createdAt: NOW.toISOString(), finishedAt: NOW.toISOString(), version: "0.1.0", source: { kind: "category", value: "Test" }, done: 1 });
    expect(run.counts).toMatchObject({ ghost: 1, buried: 1 });
    expect(run.notChecked).toBe(0);
  });

  it("saves after every article and continues from the last finished one", async () => {
    const docs = [article("A", [{ site: 0 }]), article("B", [{ site: 5 }]), article("C", [{ site: 10 }])];
    const first = census(docs);
    const saved: number[] = [];
    const stop = new AbortController();
    const outcome = await runCensus(first.run, {
      ...first.deps,
      signal: stop.signal,
      save: (r) => {
        saved.push(r.done);
        if (r.done === 2) stop.abort();
      },
    });
    expect(outcome.stop).toBe("aborted");
    expect(saved).toEqual([1, 2]);

    const resumed = census(docs);
    const reopened = JSON.parse(JSON.stringify(first.run)) as CensusRun;
    expect((await runCensus(reopened, resumed.deps)).stop).toBe("finished");
    expect(resumed.calls).toEqual([urlOf(10)]);
    expect(reopened.done).toBe(3);
  });

  it("records nothing from an article it was stopped in, and pauses instead of skipping it", async () => {
    let n = 0;
    const { run, deps, calls } = census([article("A", [{ site: 0 }]), article("B", [{ site: 5 }, { site: 6 }, { site: 7 }])], {
      concurrency: 1,
      examine: async (req) => {
        if (req.url === urlOf(6) && n++ === 0) throw new CensusPaused("The hourly limit was reached.");
        return fakeExamination(req);
      },
    });
    const outcome = await runCensus(run, deps);
    expect(outcome).toEqual({ stop: "paused", reason: "The hourly limit was reached." });
    expect(run.done).toBe(1);
    expect(run.seenUrls).toEqual([urlOf(0)]);
    expect(run.rows).toHaveLength(1);
    expect(calls).toEqual([]);

    // later the same run goes on and finishes the article it stopped in
    expect((await runCensus(run, deps)).stop).toBe("finished");
    expect(run.done).toBe(2);
    expect(run.seenUrls).toEqual([urlOf(0), urlOf(5), urlOf(6), urlOf(7)]);
  });

  it("skips an article that cannot be loaded, says why, and keeps going", async () => {
    const { run, deps } = census([article("A", [{ site: 3 }])]);
    run.articles.unshift("Missing");
    await runCensus(run, deps);
    expect(run.errors).toEqual([{ article: "Missing", message: 'No Wikipedia article called "Missing"' }]);
    expect(run.done).toBe(2);
  });

  it("pauses when Wikipedia is busy while loading", async () => {
    const { run, deps } = census([article("A", [{ site: 3 }])], {
      load: async () => {
        throw new CensusPaused("Wikipedia answered 429");
      },
    });
    expect(await runCensus(run, deps)).toEqual({ stop: "paused", reason: "Wikipedia answered 429" });
    expect(run.done).toBe(0);
    expect(run.errors).toEqual([]);
  });

  it("counts a link whose examination crashes as unknown, never as a finding", async () => {
    const { run, deps } = census([article("A", [{ site: 0 }])], {
      examine: async () => {
        throw new Error("the examiner fell over");
      },
    });
    await runCensus(run, deps);
    expect(run.counts.unknown).toBe(1);
    expect(run.rows).toEqual([]);
  });

  it("gives up on one stuck examination, counts it as unknown and goes on", async () => {
    const { run, deps } = census([article("A", [{ site: 0 }, { site: 3 }])], {
      examineTimeoutMs: 50,
      examine: async (req) => (req.url === urlOf(0) ? new Promise<Examination>(() => {}) : fakeExamination(req)),
    });
    expect(await runCensus(run, deps)).toEqual({ stop: "finished" });
    expect(run.counts).toMatchObject({ unknown: 1, alive: 1 });
    expect(run.rows).toEqual([]);
  });

  it("examines at most maxLinks links per article and says how many it left", async () => {
    const { run, deps, calls } = census([article("A", [{ site: 0 }, { site: 3 }, { site: 5 }, { site: 8 }])], { maxLinks: 2 });
    await runCensus(run, deps);
    expect(calls).toEqual([urlOf(0), urlOf(3)]);
    expect(run.notChecked).toBe(2);
  });

  it("refuses to repeat a URL even when two articles cite it with different access dates", async () => {
    const { run, deps, calls } = census([article("A", [{ site: 0, accessDate: "2012-05-01" }]), article("B", [{ site: 0, accessDate: "2020-05-01" }])]);
    await runCensus(run, deps);
    expect(calls).toEqual([urlOf(0)]);
  });
});

describe("the report", () => {
  it("totals articles, citations, verdicts and the share of citations affected", async () => {
    const { run, deps } = census([article("A", [{ site: 0 }, { site: 3 }]), article("B", [{ site: 5 }, { site: 2 }])]);
    await runCensus(run, deps);
    const { totals } = buildReport(run);
    // the ghost has a single signal, so it waits in review
    expect(totals).toMatchObject({ articles: 2, articlesDone: 2, citations: 4, urls: 4, untaggedPossessed: 2, worklist: 2, review: 1, shareAffected: 0.5 });
    expect(totals.counts).toMatchObject({ possessed: 2, alive: 1, ghost: 1 });
  });

  it("lists possessed before ghosts, strongest first", async () => {
    // give the ghost a second, independent signal so it reaches the main worklist
    const twoSignals = async (req: ExamineRequest): Promise<Examination> => {
      const ex = fakeExamination(req);
      return ex.verdict === "ghost" ? { ...ex, evidence: [...ex.evidence, { signal: "redirect-to-home", points: "ghost", weight: 0.6, detail: "The link lands on the home page." }] } : ex;
    };
    const { run, deps } = census([article("A", [{ site: 2 }, { site: 0 }, { site: 5 }])], { examine: twoSignals });
    await runCensus(run, deps);
    expect(buildReport(run).worklist.map((r) => r.verdict)).toEqual(["possessed", "possessed", "ghost"]);
  });

  it("counts one signal per family: parking-host and parking-page are one cause", () => {
    const ex = fakeExamination({ linkId: "x", url: urlOf(1) });
    expect(supportingEvidence(ex)).toEqual(["parking-host says possessed."]);
  });

  it("exports a CSV and a wikitext table that name the row, never edit anything", async () => {
    const { run, deps } = census([article("A", [{ site: 0 }])]);
    await runCensus(run, deps);
    const report = buildReport(run);
    const csv = toCsv(report.worklist);
    expect(csv.split("\r\n")[0]).toBe("section,article,claim,url,verdict,confidence,tagged,needs_new_source,evidence,fix");
    expect(parseCsv(csv)).toEqual(report.worklist);
    const wiki = toWikitext(report);
    expect(wiki).toContain("[[:A]]");
    expect(wiki).toContain("http&#58;//site0.example.org/page0");
    expect(wiki).not.toMatch(/https?:/);
  });

  it("keeps a spreadsheet from running text taken from a web page as a formula", () => {
    const row = { article: "A", claim: '=HYPERLINK("http://evil.example/","click")', url: "@x", verdict: "possessed" as const, confidence: 1, tagged: false, evidence: ["+cmd|' /C calc'!A0"], needsNewSource: false };
    const csv = toCsv([row]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example/"",""click"")"`);
    expect(csv).toContain(",'@x,");
    expect(csv).toContain("'+cmd|' /C calc'!A0");
    expect(parseCsv(csv)).toEqual([row]);
  });
});

describe("saved runs", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("round-trips through a file and refuses a run id that points outside the folder", async () => {
    dir = await mkdtemp(join(tmpdir(), "revenant-census-"));
    const { run, deps } = census([article("A", [{ site: 0 }])]);
    await runCensus(run, deps);
    const path = await saveRun(run, dir);
    expect(path.startsWith(dir)).toBe(true);
    expect(JSON.parse(await readFile(path, "utf8")).id).toBe(run.id);
    expect(await loadRun(run.id, dir)).toEqual(JSON.parse(JSON.stringify(run)));
    await expect(loadRun("../../etc/passwd", dir)).rejects.toThrow(/not a census run id/);
    await expect(loadRun("nothing-here", dir)).rejects.toThrow(/No saved census/);
  });

  it("rejects a file that is not a census run", () => {
    expect(() => parseCensusRun({ id: "x" })).toThrow();
    expect(() => parseCensusRun(null)).toThrow();
  });
});
