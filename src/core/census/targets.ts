/**
 * Turn what a person typed into a list of article titles: a category, a
 * domain, or a list of titles. Server-only (MediaWiki API calls).
 */
import { FetchFailure, safeFetch } from "../net/fetch";
import { SourceError, WIKI_UA } from "../sources";
import { DEFAULT_LIMIT, type CensusSource } from "./types";

export interface ParsedTarget {
  source: CensusSource;
  /** Present for a list of titles: the titles themselves. */
  titles?: string[];
}

const LANG = /^[a-z]{2,12}(?:-[a-z]{2,12})?$/;
/** The language ends up in a hostname that is fetched without the SSRF check, so keep it to letters and one hyphen. */
export function isLang(value: string): boolean {
  return LANG.test(value);
}

const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}$/;

function cleanTitle(line: string): string {
  const url = line.match(/^https?:\/\/([a-z-]{2,12})\.wikipedia\.org\/wiki\/([^?#]+)/i);
  const raw = url ? decodeURIComponent(url[2]) : line;
  return raw.replace(/^\[\[|\]\]$/g, "").replace(/_/g, " ").trim();
}

/** One title per line; blank lines and lines starting with # are ignored; repeats are dropped. */
export function parseTitleList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const title = cleanTitle(t);
    if (title && !seen.has(title)) {
      seen.add(title);
      out.push(title);
    }
  }
  return out;
}

/** Understand what the user typed. Throws {@link SourceError} with a message fit to show. */
export function parseCensusSource(raw: string, lang = "en"): ParsedTarget {
  const s = raw.trim();
  if (!s) throw new SourceError("Give a category, a domain such as domain:example.com, or one article title per line.");
  if (!isLang(lang)) throw new SourceError("That is not a Wikipedia language code.");

  if (s.includes("\n")) {
    const titles = parseTitleList(s);
    if (!titles.length) throw new SourceError("The list has no article titles.");
    return { source: { kind: "titles", value: `${titles.length} titles`, lang }, titles };
  }

  const wiki = s.match(/^https?:\/\/([a-z-]{2,12})(?:\.m)?\.wikipedia\.org\/wiki\/([^?#]+)/i);
  if (wiki) {
    const title = decodeURIComponent(wiki[2]).replace(/_/g, " ");
    if (!/^category:/i.test(title)) throw new SourceError("That page is not a category. Type the category as Category:Name (that spelling works on every wiki), or put article titles one per line.");
    return { source: { kind: "category", value: title.replace(/^category:/i, "").trim(), lang: wiki[1].toLowerCase() } };
  }

  const dom = s.match(/^domain:\s*(.+)$/i) ?? s.match(/^https?:\/\/([^/?#]+)/i);
  if (dom) {
    const host = dom[1]
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[/?#].*$/, "")
      .replace(/:\d+$/, "")
      .replace(/^\*\./, "");
    if (!DOMAIN.test(host)) throw new SourceError(`"${dom[1].trim()}" is not a domain name. Try domain:example.com.`);
    return { source: { kind: "domain", value: host, lang } };
  }

  const name = s.replace(/^(?:category|cat):\s*/i, "").replace(/_/g, " ").trim();
  if (!name) throw new SourceError("The category name is empty.");
  return { source: { kind: "category", value: name, lang } };
}

// ---- MediaWiki API -----------------------------------------------------------

/** Wikipedia is busy or unreachable: the right answer is to wait, not to give up on the page. */
export function isBusy(error: unknown): boolean {
  if (error instanceof SourceError) return /answered (429|5\d\d)/.test(error.message);
  return error instanceof FetchFailure && error.kind !== "blocked";
}

interface ListResponse {
  query?: Record<string, { title: string }[]>;
  continue?: Record<string, string>;
  error?: { info?: string };
}
/** One API call; injected in tests. */
export type WikiGet = (lang: string, params: Record<string, string>) => Promise<ListResponse>;

export const wikiGet: WikiGet = async (lang, params) => {
  if (!isLang(lang)) throw new SourceError("That is not a Wikipedia language code.");
  const q = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params });
  const r = await safeFetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, {
    trusted: true,
    timeoutMs: 20_000,
    maxBytes: 4_000_000,
    headers: { "user-agent": WIKI_UA, accept: "application/json" },
  });
  if (r.status !== 200) throw new SourceError(`Wikipedia answered ${r.status}`);
  let data: ListResponse;
  try {
    data = JSON.parse(r.body) as ListResponse;
  } catch {
    throw new SourceError("Wikipedia sent an answer Revenant could not read.");
  }
  if (data.error) throw new SourceError(`Wikipedia refused the request: ${data.error.info ?? "unknown error"}`);
  return data;
};

/** 500 titles per request is the API maximum; this bounds a runaway query. */
const MAX_PAGES = 40;

async function collect(
  get: WikiGet,
  lang: string,
  list: string,
  params: Record<string, string>,
  into: Set<string>,
  limit: number,
): Promise<boolean> {
  let cont: Record<string, string> = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await get(lang, { list, ...params, ...cont });
    for (const m of data.query?.[list] ?? []) into.add(m.title);
    if (into.size >= limit) return into.size > limit || Boolean(data.continue);
    // keep following `continue` even after an empty page: the API may return none before it has more
    if (!data.continue) return false;
    cont = data.continue;
  }
  return true;
}

/**
 * Resolve the target into article titles (namespace 0), at most `limit` for a
 * category or domain. `more` is true when the source has more articles than were
 * taken. A category's subcategories are not followed.
 */
export async function resolveTargets(
  target: ParsedTarget,
  limit = DEFAULT_LIMIT,
  get: WikiGet = wikiGet,
): Promise<{ articles: string[]; more: boolean }> {
  if (!Number.isInteger(limit) || limit < 1) throw new SourceError("The limit must be a whole number of at least 1.");
  const { source } = target;
  const titles = new Set<string>();
  let more = false;

  // a list of titles is used as given (Requirement 1.3); the limit is for categories and domains
  if (source.kind === "titles") return { articles: target.titles ?? [], more: false };

  if (source.kind === "category") {
    more = await collect(
      get,
      source.lang,
      "categorymembers",
      { cmtitle: `Category:${source.value}`, cmnamespace: "0", cmtype: "page", cmlimit: "500", cmprop: "title" },
      titles,
      limit,
    );
    if (!titles.size) throw new SourceError(`No articles found in Category:${source.value} on ${source.lang}.wikipedia.org. Check the spelling; subcategories are not searched.`);
  } else {
    // example.com and *.example.com are different queries in LinkSearch
    const queries = source.value.startsWith("www.") ? [source.value] : [source.value, `*.${source.value}`];
    for (const euquery of queries) {
      more = await collect(get, source.lang, "exturlusage", { euquery, eunamespace: "0", eulimit: "500", euprop: "title" }, titles, limit);
      if (titles.size >= limit) break;
    }
    if (!titles.size) throw new SourceError(`No articles on ${source.lang}.wikipedia.org link to ${source.value}.`);
  }

  const all = [...titles];
  return { articles: all.slice(0, limit), more: more || all.length > limit };
}
