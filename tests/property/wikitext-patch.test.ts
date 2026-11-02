/**
 * Property tests for the wikitext patcher (spec: .kiro/specs/citation-patcher).
 * The patcher edits live Wikipedia articles, so the guarantees are strict:
 * it touches only the parameters it was asked to set, never another byte.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { extractWikitext, findTemplates, parseTemplate } from "../../src/core/extract/wikitext";
import { applyEdits, formatDateLike, setTemplateParams } from "../../src/core/patch/wikitext";

const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,14}$/);
const paramName = fc.constantFrom("title", "website", "publisher", "work", "last", "first", "date", "language", "page");
const urlArb = fc
  .tuple(fc.stringMatching(/^[a-z]{3,10}$/), fc.constantFrom("com", "org", "net", "co.uk"), fc.stringMatching(/^[a-z0-9-]{1,12}$/))
  .map(([d, tld, p]) => `http://www.${d}.${tld}/${p}.html`);

/** A {{cite web}} with random params and a random spacing style. */
const citeArb = fc
  .record({
    url: urlArb,
    params: fc.uniqueArray(fc.tuple(paramName, word), { selector: ([n]) => n, maxLength: 5 }),
    style: fc.constantFrom("tight", "spaced", "multiline", "airy"),
    access: fc.option(fc.constantFrom("2014-03-06", "6 March 2014", "March 6, 2014"), { nil: undefined }),
    status: fc.option(fc.constantFrom("live", "dead"), { nil: undefined }),
  })
  .map(({ url, params, style, access, status }) => {
    const all: [string, string][] = [["url", url], ...params];
    if (access) all.push(["access-date", access]);
    if (status) all.push(["url-status", status]);
    const seg = ([k, v]: [string, string]) =>
      style === "tight" ? `|${k}=${v}` : style === "spaced" ? ` |${k}=${v}` : style === "airy" ? ` | ${k} = ${v}` : `\n| ${k} = ${v}`;
    return `{{cite web${all.map(seg).join("")}${style === "multiline" ? "\n" : ""}}}`;
  });

const articleArb = fc
  .tuple(fc.array(word, { minLength: 1, maxLength: 3 }), citeArb, fc.array(word, { maxLength: 3 }))
  .map(([before, cite, after]) => `${before.join(" ")}. Claim sentence.<ref>${cite}</ref> ${after.join(" ")}\n`);

const updatesArb = fc.record({
  "archive-url": fc.constant("https://web.archive.org/web/20140320152702/http://example.com/x"),
  "archive-date": fc.constant("2014-03-20"),
  "url-status": fc.constantFrom("usurped", "dead", "deviated", "unfit"),
});

function patchFirstCite(text: string, updates: Record<string, string>): string {
  const t = findTemplates(text).find((x) => x.name.startsWith("cite"))!;
  return applyEdits(text, setTemplateParams(text, t.span, updates));
}

describe("wikitext patcher properties", () => {
  it("Property 1: text outside the patched template is byte-identical", () => {
    fc.assert(
      fc.property(articleArb, updatesArb, (text, updates) => {
        const t = findTemplates(text).find((x) => x.name.startsWith("cite"))!;
        const out = patchFirstCite(text, updates);
        const tail = text.length - t.span.end;
        expect(out.slice(0, t.span.start)).toBe(text.slice(0, t.span.start));
        expect(out.slice(out.length - tail)).toBe(text.slice(t.span.end));
      }),
    );
  });

  it("Property 2: every parameter not being set keeps its exact value", () => {
    fc.assert(
      fc.property(articleArb, updatesArb, (text, updates) => {
        const before = findTemplates(text).find((x) => x.name.startsWith("cite"))!;
        const out = patchFirstCite(text, updates);
        const after = findTemplates(out).find((x) => x.name.startsWith("cite"))!;
        for (const p of before.params) {
          if (p.name && p.name in updates) continue;
          const match = after.params.find((q) => q.name === p.name);
          expect(match?.value.trim()).toBe(p.value.trim());
        }
      }),
    );
  });

  it("Property 3: after patching, the template carries exactly the requested values", () => {
    fc.assert(
      fc.property(articleArb, updatesArb, (text, updates) => {
        const out = patchFirstCite(text, updates);
        const t = parseTemplate(out, findTemplates(out).find((x) => x.name.startsWith("cite"))!.span);
        for (const [k, v] of Object.entries(updates)) {
          const matches = t.params.filter((p) => p.name === k);
          expect(matches).toHaveLength(1);
          expect(matches[0].value.trim()).toBe(v);
        }
      }),
    );
  });

  it("Property 4: patching is idempotent", () => {
    fc.assert(
      fc.property(articleArb, updatesArb, (text, updates) => {
        const once = patchFirstCite(text, updates);
        const twice = patchFirstCite(once, updates);
        expect(twice).toBe(once);
      }),
    );
  });

  it("Property 5: the cited URL and access date survive the patch", () => {
    fc.assert(
      fc.property(articleArb, updatesArb, (text, updates) => {
        const [before] = extractWikitext(text);
        const [after] = extractWikitext(patchFirstCite(text, updates));
        expect(after.url).toBe(before.url);
        expect(after.accessDate).toBe(before.accessDate);
        expect(after.existingStatus).toBe(updates["url-status"]);
      }),
    );
  });

  it("formatDateLike keeps the citation's date style", () => {
    expect(formatDateLike("2014-03-20", "6 March 2014")).toBe("20 March 2014");
    expect(formatDateLike("2014-03-20", "March 6, 2014")).toBe("March 20, 2014");
    expect(formatDateLike("2014-03-20", "2014-03-06")).toBe("2014-03-20");
    expect(formatDateLike("2014-03-20")).toBe("2014-03-20");
  });

  it("legacy dead-url=yes is rewritten to url-status, not duplicated", () => {
    const text = "x<ref>{{cite web |url=http://a.example.com/p |title=T |dead-url=yes}}</ref>";
    const out = patchFirstCite(text, { "url-status": "dead" });
    expect(out).toContain("|url-status=dead");
    expect(out).not.toContain("dead-url");
  });
});
