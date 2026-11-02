/**
 * Property tests for archive snapshot selection (spec: .kiro/specs/resurrection-engine).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rankSnapshots, selectSnapshot } from "../../src/core/archive/select";
import type { Snapshot } from "../../src/core/types";
import { isoToTimestamp, timestampToMs } from "../../src/core/url";

const tsArb = fc
  .date({ min: new Date("1997-01-01T00:00:00Z"), max: new Date("2026-10-01T00:00:00Z"), noInvalidDate: true })
  .map((d) => isoToTimestamp(d.toISOString()));

const snapArb: fc.Arbitrary<Snapshot> = fc.record({
  timestamp: tsArb,
  original: fc.constant("http://example.com/page"),
  status: fc.constantFrom(200, 200, 200, 301, 404, 500),
  mimetype: fc.constantFrom("text/html", "text/html", "application/pdf", "image/png", "warc/revisit"),
});

const isoArb = fc
  .date({ min: new Date("1998-01-01T00:00:00Z"), max: new Date("2026-10-01T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

describe("snapshot selection properties", () => {
  it("Property 6: never selects a copy captured on or after the takeover date", () => {
    fc.assert(
      fc.property(fc.array(snapArb, { maxLength: 30 }), isoArb, fc.option(isoArb, { nil: undefined }), (snaps, takeover, target) => {
        const s = selectSnapshot(snaps, { notAfter: takeover, target });
        if (s) expect(s.timestamp < isoToTimestamp(takeover)).toBe(true);
      }),
    );
  });

  it("Property 7: only ever selects 200 responses with a readable type", () => {
    fc.assert(
      fc.property(fc.array(snapArb, { maxLength: 30 }), fc.option(isoArb, { nil: undefined }), (snaps, target) => {
        for (const s of rankSnapshots(snaps, { target })) {
          expect(s.status).toBe(200);
          expect(s.mimetype).not.toBe("image/png");
        }
      }),
    );
  });

  it("Property 8: the selected copy is the closest eligible one to the target", () => {
    fc.assert(
      fc.property(fc.array(snapArb, { minLength: 1, maxLength: 30 }), isoArb, (snaps, target) => {
        const best = selectSnapshot(snaps, { target });
        const eligible = snaps.filter((s) => s.status === 200 && s.mimetype !== "image/png");
        if (eligible.length === 0) {
          expect(best).toBeUndefined();
          return;
        }
        const t = Date.parse(`${target}T00:00:00Z`);
        const bestDist = Math.abs(timestampToMs(best!.timestamp) - t);
        for (const s of eligible) expect(bestDist).toBeLessThanOrEqual(Math.abs(timestampToMs(s.timestamp) - t));
      }),
    );
  });

  it("Property 9: if any eligible copy predates the takeover, one is selected", () => {
    fc.assert(
      fc.property(fc.array(snapArb, { maxLength: 30 }), isoArb, (snaps, takeover) => {
        const cut = isoToTimestamp(takeover);
        const exists = snaps.some((s) => s.status === 200 && s.mimetype !== "image/png" && s.timestamp < cut);
        expect(Boolean(selectSnapshot(snaps, { notAfter: takeover }))).toBe(exists);
      }),
    );
  });
});
