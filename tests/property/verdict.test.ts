/**
 * Property tests for the verdict procedure (spec: .kiro/specs/link-classifier).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decide, remedyFor, type Observations } from "../../src/core/signals/verdict";
import type { LiveObservation } from "../../src/core/types";
import { PARKING_PHRASES, SPAM_TERMS } from "../../src/core/signals/lexicon";

const prose = fc
  .array(fc.constantFrom("history", "language", "release", "server", "museum", "report", "council", "river", "budget", "theory", "season"), {
    minLength: 5,
    maxLength: 40,
  })
  .map((w) => w.join(" "));

const liveOk: fc.Arbitrary<LiveObservation> = fc.record({
  ok: fc.constant(true),
  status: fc.constantFrom(200, 203),
  finalUrl: fc.constant("https://example.org/docs/page.html"),
  redirects: fc.constant([] as string[]),
  title: prose,
  text: prose,
  fetchedAt: fc.constant("2026-11-01T00:00:00Z"),
});

const base = (live: LiveObservation): Observations => ({ url: "https://example.org/docs/page.html", live });

describe("verdict properties", () => {
  it("Property 10: a 404 or 410 is always buried", () => {
    fc.assert(
      fc.property(fc.constantFrom(404, 410), (status) => {
        const d = decide(base({ ok: false, status, redirects: [], fetchedAt: "x" }));
        expect(d.verdict).toBe("buried");
      }),
    );
  });

  it("Property 11: a domain that no longer resolves is always buried", () => {
    const d = decide(base({ ok: false, errorKind: "dns", redirects: [], fetchedAt: "x" }));
    expect(d.verdict).toBe("buried");
  });

  it("Property 12: a page that answered is never buried, and a page that failed is never alive", () => {
    fc.assert(
      fc.property(liveOk, fc.boolean(), (live, fail) => {
        const obs = fail ? { ...live, ok: false, status: 500 } : live;
        const d = decide(base(obs));
        if (obs.ok) expect(d.verdict).not.toBe("buried");
        else expect(d.verdict).not.toBe("alive");
      }),
    );
  });

  it("Property 13: turning a page into a parked domain never leaves it alive", () => {
    fc.assert(
      fc.property(liveOk, fc.subarray([...PARKING_PHRASES], { minLength: 2, maxLength: 4 }), (live, phrases) => {
        const parked = { ...live, text: `${phrases.join(". ")}. ${live.text}` };
        expect(decide(base(parked)).verdict).toBe("possessed");
      }),
    );
  });

  it("Property 14: a gambling takeover the archive never had is possessed", () => {
    fc.assert(
      fc.property(liveOk, prose, fc.subarray([...SPAM_TERMS].slice(0, 30), { minLength: 6, maxLength: 10 }), (live, archived, spam) => {
        const d = decide({
          ...base({ ...live, text: `${spam.join(" ")} ${live.text}` }),
          archive: {
            snapshot: { timestamp: "20140320152702", original: "https://example.org/docs/page.html", status: 200 },
            title: "Docs",
            text: archived,
            candidates: 1,
          },
        });
        expect(d.verdict).toBe("possessed");
      }),
    );
  });

  it("Property 15: confidence is always within [0, 1] and every verdict has a summary", () => {
    fc.assert(
      fc.property(liveOk, fc.boolean(), (live, failed) => {
        const d = decide(base(failed ? { ...live, ok: false, status: 503 } : live));
        expect(d.confidence).toBeGreaterThanOrEqual(0);
        expect(d.confidence).toBeLessThanOrEqual(1);
        expect(d.summary.length).toBeGreaterThan(5);
      }),
    );
  });

  it("Property 16: possessed links are hidden (usurped/unfit), changelings are marked deviated", () => {
    const archive = {
      snapshot: { timestamp: "20140320152702", original: "http://example.org/p", status: 200 },
      text: "the original page",
      candidates: 1,
    };
    const possessed = remedyFor({ verdict: "possessed", confidence: 0.9, evidence: [], summary: "" }, archive);
    expect(["usurped", "unfit"]).toContain(possessed.urlStatus);
    const changeling = remedyFor({ verdict: "changeling", confidence: 0.9, evidence: [], summary: "" }, archive);
    expect(changeling.urlStatus).toBe("deviated");
    expect(remedyFor({ verdict: "buried", confidence: 0.9, evidence: [], summary: "" }).action).toBe("manual");
  });

  it("re-registration after the access date counts as possessed when the content changed", () => {
    const d = decide({
      url: "http://www.interoperabilitybridges.com/projects/php-sdk-for-windows-azure.aspx",
      accessDate: "2014-03-06",
      title: "Windows Azure SDK for PHP",
      live: {
        ok: true,
        status: 200,
        finalUrl: "https://interoperabilitybridges.com/",
        redirects: ["https://interoperabilitybridges.com/"],
        title: "Bandar Toto Macau",
        text: "togel slot gacor live casino daftar situs",
        fetchedAt: "x",
      },
      domain: { domain: "interoperabilitybridges.com", registeredAt: "2024-07-29T18:35:21Z", rdapAvailable: true },
      archive: {
        snapshot: { timestamp: "20140320152702", original: "x", status: 200 },
        title: "Windows Azure SDK for PHP - Interoperability Bridges",
        text: "Windows Azure SDK for PHP enables PHP developers to use Windows Azure storage",
        candidates: 3,
      },
    });
    expect(d.verdict).toBe("possessed");
    expect(d.takeoverDate).toBe("2024-07-29");
  });
});
