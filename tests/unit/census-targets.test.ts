/** Spec: .kiro/specs/graveyard-census, Requirement 1. No network: the MediaWiki API is a stub. */
import { describe, expect, it } from "vitest";
import { parseCensusSource, parseTitleList, resolveTargets, type WikiGet } from "../../src/core/census/targets";
import { SourceError } from "../../src/core/sources";

/** A stub API that serves `titles` in pages of `pageSize` and records every request. */
function pagedApi(list: string, titles: string[], pageSize: number, requests: Record<string, string>[] = []): WikiGet {
  return async (_lang, params) => {
    requests.push(params);
    const from = Number(params.offset ?? 0);
    const page = titles.slice(from, from + pageSize);
    const next = from + pageSize < titles.length ? { continue: { offset: String(from + pageSize), continue: "-||" } } : {};
    return { query: { [list]: page.map((title) => ({ title })) }, ...next };
  };
}

describe("parsing what the user typed", () => {
  it("reads a category in all its spellings", () => {
    expect(parseCensusSource("Category:PHP").source).toEqual({ kind: "category", value: "PHP", lang: "en" });
    expect(parseCensusSource("category: Web_development").source.value).toBe("Web development");
    expect(parseCensusSource("Web frameworks").source).toEqual({ kind: "category", value: "Web frameworks", lang: "en" });
    expect(parseCensusSource("https://fr.wikipedia.org/wiki/Category:Pont_de_France").source).toEqual({ kind: "category", value: "Pont de France", lang: "fr" });
  });

  it("reads a domain from domain: or from a URL", () => {
    expect(parseCensusSource("domain:Example.COM").source).toEqual({ kind: "domain", value: "example.com", lang: "en" });
    expect(parseCensusSource("domain: https://www.example.com/a?b#c").source.value).toBe("www.example.com");
    expect(parseCensusSource("https://news.example.co.uk/story").source.value).toBe("news.example.co.uk");
  });

  it("rejects what is not a domain, an article page or a language code", () => {
    expect(() => parseCensusSource("domain:not a domain")).toThrow(SourceError);
    expect(() => parseCensusSource("https://en.wikipedia.org/wiki/PHP")).toThrow(/not a category.*Category:Name/);
    expect(() => parseCensusSource("   ")).toThrow(SourceError);
    expect(() => parseCensusSource("Category:PHP", "en.evil.com/")).toThrow(/language code/);
  });

  it("uses a list of titles as it is: one per line, comments and repeats dropped", () => {
    const parsed = parseCensusSource("PHP\n# a comment\n\n[[Perl]]\nPHP\nhttps://en.wikipedia.org/wiki/Ruby_(programming_language)\nweb_server");
    expect(parsed.source.kind).toBe("titles");
    expect(parsed.titles).toEqual(["PHP", "Perl", "Ruby (programming language)", "web server"]);
    expect(parseTitleList("a\r\nb\r\n")).toEqual(["a", "b"]);
  });
});

describe("resolving targets", () => {
  const names = Array.from({ length: 1200 }, (_, i) => `Article ${i}`);

  it("lists category members of namespace 0, following continue, up to the limit", async () => {
    const requests: Record<string, string>[] = [];
    const get = pagedApi("categorymembers", names, 500, requests);
    const { articles, more } = await resolveTargets(parseCensusSource("Category:Big"), 700, get);
    expect(articles).toEqual(names.slice(0, 700));
    expect(more).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ list: "categorymembers", cmtitle: "Category:Big", cmnamespace: "0", cmtype: "page", cmlimit: "500" });
    expect(requests[1].offset).toBe("500");
  });

  it("says there is no more when the category fits in the limit", async () => {
    const { articles, more } = await resolveTargets(parseCensusSource("Category:Small"), 200, pagedApi("categorymembers", names.slice(0, 150), 500));
    expect(articles).toHaveLength(150);
    expect(more).toBe(false);
  });

  it("defaults to 200 articles", async () => {
    const { articles, more } = await resolveTargets(parseCensusSource("Category:Big"), undefined, pagedApi("categorymembers", names, 500));
    expect(articles).toHaveLength(200);
    expect(more).toBe(true);
  });

  it("keeps following continue past an empty page (LinkSearch can return none before it has more)", async () => {
    let calls = 0;
    const get: WikiGet = async (_lang, params) => {
      if (params.euquery?.startsWith("*.")) return { query: { exturlusage: [] } };
      calls++;
      return calls < 3 ? { query: { exturlusage: [] }, continue: { eucontinue: String(calls) } } : { query: { exturlusage: [{ title: "Late" }] } };
    };
    const { articles } = await resolveTargets(parseCensusSource("domain:example.com"), 10, get);
    expect(articles).toEqual(["Late"]);
    expect(calls).toBe(3);
  });

  it("asks for the bare domain and its subdomains, and lists each article once", async () => {
    const queries: string[] = [];
    const get: WikiGet = async (_lang, params) => {
      queries.push(params.euquery);
      // the same article links to the domain twice
      return { query: { exturlusage: params.euquery === "example.com" ? [{ title: "A" }, { title: "A" }, { title: "B" }] : [{ title: "B" }, { title: "C" }] } };
    };
    const { articles } = await resolveTargets(parseCensusSource("domain:example.com"), 10, get);
    expect(queries).toEqual(["example.com", "*.example.com"]);
    expect(articles).toEqual(["A", "B", "C"]);
  });

  it("does not ask twice for a www host", async () => {
    const queries: string[] = [];
    await resolveTargets(parseCensusSource("domain:www.example.com"), 10, async (_l, p) => (queries.push(p.euquery), { query: { exturlusage: [{ title: "A" }] } }));
    expect(queries).toEqual(["www.example.com"]);
  });

  it("returns a list of titles whole, whatever the limit", async () => {
    const { articles, more } = await resolveTargets(parseCensusSource("A\nB\nC"), 2, async () => {
      throw new Error("no request expected");
    });
    expect(articles).toEqual(["A", "B", "C"]);
    expect(more).toBe(false);
  });

  it("explains an empty category and a bad limit", async () => {
    await expect(resolveTargets(parseCensusSource("Category:Nope"), 5, async () => ({ query: { categorymembers: [] } }))).rejects.toThrow(/No articles found in Category:Nope/);
    await expect(resolveTargets(parseCensusSource("Category:x"), 0)).rejects.toThrow(/limit/);
  });
});
