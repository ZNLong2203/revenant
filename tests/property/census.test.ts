/**
 * Property tests for the Graveyard Census (spec: .kiro/specs/graveyard-census).
 * Property C1 and C2 run the real engine against pretend articles and a
 * pretend examine step; C3 to C5 test the report on generated rows.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildReport, parseCsv, toCsv, toWikitext } from "../../src/core/census/report";
import { createRun, runCensus, type CensusDeps } from "../../src/core/census/run";
import type { CensusRow, CensusRun } from "../../src/core/census/types";
import type { ExamineRequest } from "../../src/core/types";
import { VERDICTS } from "../../src/core/types";
import { article, fakeExamination, type CiteSpec } from "../helpers/census-fixtures";

const NOW = new Date("2026-11-03T00:00:00Z");

// ---- C1 and C2: the engine ---------------------------------------------------

/** A census input: articles, each a list of cited site numbers (a small pool, so URLs repeat). */
const articlesArb = fc.array(fc.array(fc.integer({ min: 0, max: 14 }), { maxLength: 8 }), { minLength: 1, maxLength: 7 });

function setup(shape: number[][]) {
  const docs = new Map(shape.map((sites, i) => [`Article ${i}`, article(`Article ${i}`, sites.map((site): CiteSpec => ({ site })))]));
  const calls: string[] = [];
  const deps: CensusDeps = {
    load: async (title) => docs.get(title)!,
    examine: async (req: ExamineRequest) => {
      calls.push(req.url);
      return fakeExamination(req);
    },
    now: () => NOW,
  };
  const run = createRun({ kind: "titles", value: "test", lang: "en" }, [...docs.keys()], { now: NOW });
  return { run, deps, calls };
}

describe("census engine properties", () => {
  it("Property C1: a URL is examined at most once in a run", async () => {
    await fc.assert(
      fc.asyncProperty(articlesArb, fc.integer({ min: 1, max: 5 }), async (shape, concurrency) => {
        const { run, deps, calls } = setup(shape);
        await runCensus(run, { ...deps, concurrency });
        expect(new Set(calls).size).toBe(calls.length);
        expect(run.seenUrls.length).toBe(calls.length);
      }),
    );
  });

  it("Property C2: resuming after any prefix of articles gives the report of an uninterrupted run", async () => {
    await fc.assert(
      fc.asyncProperty(articlesArb, fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 4 }), async (shape, stopAfter, concurrency) => {
        const whole = setup(shape);
        await runCensus(whole.run, { ...whole.deps, concurrency });

        const first = setup(shape);
        const stop = new AbortController();
        await runCensus(first.run, {
          ...first.deps,
          concurrency,
          signal: stop.signal,
          save: (r) => {
            if (r.done === stopAfter) stop.abort();
          },
        });
        // the saved file is all that survives an interruption
        const reopened = JSON.parse(JSON.stringify(first.run)) as CensusRun;
        const second = setup(shape);
        await runCensus(reopened, { ...second.deps, concurrency });

        expect(reopened).toEqual(whole.run);
        expect(buildReport(reopened)).toEqual(buildReport(whole.run));
        // the second leg never repeats a URL the first leg finished
        expect(second.calls.filter((u) => first.run.seenUrls.includes(u))).toEqual([]);
      }),
    );
  });
});

// ---- C3 to C5: the report ----------------------------------------------------

/** Text built from the pieces that break CSV and wikitext. */
const PIECES = ["a", "b", " ", ",", '"', "'", "\n", "\r", "\t", "=", "+", "-", "@", "|", "{{", "}}", "[[", "]]", "<ref>", "-->", "&", "#", ":", "|-", "http://x.org/?a=b|c"];
const nastyArb = fc.array(fc.constantFrom(...PIECES), { maxLength: 8 }).map((ps) => ps.join(""));
const nonEmptyNasty = nastyArb.filter((s) => s.length > 0);
const lineArb = nonEmptyNasty.map((s) => s.replace(/[\r\n]+/g, " ")).filter((s) => s.trim().length > 0);
const rowArb: fc.Arbitrary<CensusRow> = fc.record({
  article: nastyArb,
  claim: nastyArb,
  url: nastyArb,
  verdict: fc.constantFrom(...VERDICTS),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  tagged: fc.boolean(),
  evidence: fc.array(lineArb, { maxLength: 3 }),
  fix: fc.option(nonEmptyNasty, { nil: undefined }),
  needsNewSource: fc.boolean(),
});

function runWith(rows: CensusRow[], value = "Category"): CensusRun {
  return { ...createRun({ kind: "category", value, lang: "en" }, ["A"], { now: NOW }), rows };
}

describe("census report properties", () => {
  it("Property C3: every worklist row has at least two independent signals; the rest wait in review", () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 25 }), (rows) => {
        const report = buildReport(runWith(rows));
        for (const r of report.worklist) {
          expect(r.evidence.length).toBeGreaterThanOrEqual(2);
          expect(r.tagged).toBe(false);
        }
        for (const r of report.review) {
          expect(r.evidence.length).toBeLessThan(2);
          expect(r.tagged).toBe(false);
        }
        // nothing untagged is lost between the two lists
        expect(report.worklist.length + report.review.length).toBe(rows.filter((r) => !r.tagged).length);
      }),
    );
  });

  it("Property C3: untagged possessed rows come before ghosts and changelings", () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 25 }), (rows) => {
        const { worklist } = buildReport(runWith(rows));
        const firstOther = worklist.findIndex((r) => r.verdict !== "possessed");
        if (firstOther >= 0) expect(worklist.slice(firstOther).some((r) => r.verdict === "possessed")).toBe(false);
      }),
    );
  });

  it("Property C4: the CSV round-trips, including commas, quotes, newlines and formula-looking text", () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 12 }), (rows) => {
        expect(parseCsv(toCsv(rows))).toEqual(rows);
      }),
      { numRuns: 300 },
    );
  });

  it("Property C5: the wikitext table never lets a cell break the page", () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 12 }), nastyArb, (rows, category) => {
        const run = runWith(rows, category);
        const report = buildReport(run);
        const text = toWikitext(report);
        const lines = text.split("\n");
        const cellLines = lines.filter((l) => l.startsWith("| "));
        const shown = report.worklist.length + report.review.length;

        // six cells per row, one row separator per row (plus the header's) in each table
        expect(cellLines.length).toBe(shown * 6);
        expect(lines.filter((l) => l === "|-").length).toBe(shown);
        for (const cell of cellLines) {
          const body = cell.slice(2).replace(/^\[\[:[^|[\]{}<>#\n]+\]\]$/, "");
          expect(body).not.toMatch(/[|{}[\]<>]/);
          expect(body).not.toMatch(/https?:/i);
        }
        // outside the table structure no raw pipes or template braces survive
        expect(text).not.toMatch(/\{\{|\}\}/);
        for (const l of lines) {
          if (!/^(\{\||\|-|\|\}|\| |!)/.test(l)) expect(l).not.toContain("|");
        }
        expect(text.match(/<!--/g)?.length).toBe(1);
        expect(text.match(/-->/g)?.length).toBe(1);
      }),
      { numRuns: 300 },
    );
  });
});
