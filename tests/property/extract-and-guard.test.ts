/**
 * Property tests for URL normalisation, link extraction spans and the SSRF
 * guard (specs: .kiro/specs/link-classifier, .kiro/specs/resurrection-engine).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { extractMarkdown } from "../../src/core/extract/markdown";
import { extractWikitext } from "../../src/core/extract/wikitext";
import { isPrivateIPv4, isPrivateIPv6 } from "../../src/core/net/guard";
import { applyFixes } from "../../src/core/patch";
import { jaccard } from "../../src/core/text";
import { normalizeUrl } from "../../src/core/url";

const urlArb = fc.webUrl({ validSchemes: ["http", "https"], withQueryParameters: true, withFragments: true });

describe("url and text properties", () => {
  it("Property 17: normalizeUrl is idempotent", () => {
    fc.assert(
      fc.property(urlArb, (u) => {
        const once = normalizeUrl(u);
        if (once) expect(normalizeUrl(once)).toBe(once);
      }),
    );
  });

  it("Property 18: jaccard is symmetric, bounded, and 1 for identical text", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const s = jaccard(a, b);
        expect(s).toBe(jaccard(b, a));
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        expect(jaccard(a, a)).toBe(1);
      }),
    );
  });
});

const host = fc.stringMatching(/^[a-z]{3,10}$/).map((s) => `https://${s}.example.com/`);
const pathArb = fc.stringMatching(/^[a-z0-9-]{1,10}$/);

describe("extraction properties", () => {
  it("Property 19: every markdown link's urlSpan slices to its raw URL", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.stringMatching(/^[A-Za-z ]{1,12}$/), host, pathArb), { minLength: 1, maxLength: 6 }), (items) => {
        const md = items.map(([label, h, p], i) => (i % 2 ? `See [${label}](${h}${p}).` : `Read ${h}${p} today.`)).join("\n\n");
        const links = extractMarkdown(md);
        expect(links.length).toBe(items.length);
        for (const l of links) expect(md.slice(l.urlSpan.start, l.urlSpan.end)).toBe(l.rawUrl);
      }),
    );
  });

  it("Property 20: URLs inside fenced code blocks are never extracted", () => {
    fc.assert(
      fc.property(host, pathArb, (h, p) => {
        const md = `Intro.\n\n\`\`\`bash\ncurl ${h}${p}\n\`\`\`\n\nAnd \`${h}inline\` too.`;
        expect(extractMarkdown(md)).toHaveLength(0);
      }),
    );
  });

  it("Property 21: every wikitext link's urlSpan slices to its raw URL", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(host, pathArb, fc.constantFrom("cite", "bracket", "bare")), { minLength: 1, maxLength: 6 }), (items) => {
        const text = items
          .map(([h, p, kind]) =>
            kind === "cite"
              ? `Claim.<ref>{{cite web |url=${h}${p} |title=T}}</ref>`
              : kind === "bracket"
                ? `Claim.<ref>[${h}${p} Label]</ref>`
                : `Claim ${h}${p} here.`,
          )
          .join("\n");
        const links = extractWikitext(text);
        expect(links.length).toBe(items.length);
        for (const l of links) expect(text.slice(l.urlSpan.start, l.urlSpan.end)).toBe(l.rawUrl);
      }),
    );
  });

  it("Property 22: markdown fixes are idempotent and only change URLs", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(host, pathArb), { minLength: 1, maxLength: 5 }), (items) => {
        const md = items.map(([h, p]) => `- [doc](${h}${p})`).join("\n");
        const links = extractMarkdown(md);
        const fixes = links.map((link) => ({
          link,
          verdict: "buried" as const,
          remedy: { action: "archive" as const, urlStatus: "dead" as const, archiveUrl: `https://web.archive.org/web/2014/${link.url}`, archiveDate: "2014-01-01" },
        }));
        const once = applyFixes(md, fixes, "markdown");
        expect(once.applied).toHaveLength(links.length);
        expect(once.text.replace(/\(https:\/\/web\.archive\.org\/web\/2014\/[^)]+\)/g, "(X)")).toBe(md.replace(/\([^)]+\)/g, "(X)"));
        // archive URLs are not extracted again, so a second pass finds nothing to fix
        expect(extractMarkdown(once.text)).toHaveLength(0);
      }),
    );
  });
});

describe("SSRF guard properties", () => {
  const octet = fc.integer({ min: 0, max: 255 });
  it("Property 23: every RFC 1918 / loopback / link-local IPv4 is refused", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.tuple(octet, octet, octet).map(([b, c, d]) => `10.${b}.${c}.${d}`),
          fc.tuple(octet, octet, octet).map(([b, c, d]) => `127.${b}.${c}.${d}`),
          fc.tuple(fc.integer({ min: 16, max: 31 }), octet, octet).map(([b, c, d]) => `172.${b}.${c}.${d}`),
          fc.tuple(octet, octet).map(([c, d]) => `192.168.${c}.${d}`),
          fc.tuple(octet, octet).map(([c, d]) => `169.254.${c}.${d}`),
        ),
        (ip) => {
          expect(isPrivateIPv4(ip)).toBe(true);
        },
      ),
    );
  });

  it("public addresses pass, private IPv6 is refused", () => {
    expect(isPrivateIPv4("93.184.216.34")).toBe(false);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateIPv6("::1")).toBe(true);
    expect(isPrivateIPv6("fd00::1")).toBe(true);
    expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIPv6("2606:4700:4700::1111")).toBe(false);
  });
});
