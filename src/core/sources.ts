/**
 * Load a document to scan from what a person typed: a Wikipedia article, a
 * GitHub file or repo, any web page, or pasted text. Server-only.
 */
import { detectFormat, extractLinks } from "./extract";
import { cached } from "./net/cache";
import { safeFetch } from "./net/fetch";
import type { DocumentFormat, DocumentOrigin, SourceDocument } from "./types";
import { htmlTitle } from "./text";
import { shortHash } from "./url";

export const MAX_LINKS = Number(process.env.REVENANT_MAX_LINKS ?? 250);

const WIKI_UA = "RevenantBot/0.1 (https://github.com/ZNLong2203/revenant; citation health research)";

export type ScanInput =
  | { kind: "wikipedia"; lang: string; title: string }
  | { kind: "github"; owner: string; repo: string; ref?: string; path?: string }
  | { kind: "web"; url: string }
  | { kind: "paste"; text: string; format?: DocumentFormat };

/** Understand free-form input. */
export function parseInput(raw: string): ScanInput {
  const s = raw.trim();
  const wiki = s.match(/^https?:\/\/([a-z-]{2,12})(?:\.m)?\.wikipedia\.org\/wiki\/([^?#]+)/i);
  if (wiki) return { kind: "wikipedia", lang: wiki[1].toLowerCase(), title: decodeURIComponent(wiki[2]).replace(/_/g, " ") };
  const wikiIdx = s.match(/^https?:\/\/([a-z-]{2,12})\.wikipedia\.org\/w\/index\.php\?(?:.*&)?title=([^&#]+)/i);
  if (wikiIdx) return { kind: "wikipedia", lang: wikiIdx[1].toLowerCase(), title: decodeURIComponent(wikiIdx[2]).replace(/_/g, " ") };
  const short = s.match(/^(?:wiki|wp|w):(?:([a-z]{2,3}):)?(.+)$/i);
  if (short) return { kind: "wikipedia", lang: (short[1] ?? "en").toLowerCase(), title: short[2].trim() };
  const gh = s.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:blob|tree)\/([^/]+)\/(.+?))?\/?(?:[?#].*)?$/i);
  if (gh) return { kind: "github", owner: gh[1], repo: gh[2], ref: gh[3], path: gh[4] };
  if (/^https?:\/\/\S+$/i.test(s)) return { kind: "web", url: s };
  return { kind: "paste", text: raw };
}

function build(text: string, format: DocumentFormat, title: string, origin: DocumentOrigin, baseUrl?: string): SourceDocument {
  const all = extractLinks(text, format, baseUrl);
  const links = all.slice(0, MAX_LINKS);
  return {
    id: shortHash(`${origin.type}:${title}:${text.length}:${shortHash(text)}`),
    format,
    title,
    origin,
    text,
    links,
    truncated: all.length - links.length,
  };
}

export class SourceError extends Error {}

async function loadWikipedia(lang: string, title: string): Promise<SourceDocument> {
  const q = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content|ids",
    rvslots: "main",
    titles: title,
    redirects: "1",
    format: "json",
    formatversion: "2",
  });
  const data = await cached(`wiki:${lang}:${title}`, 1800, async () => {
    const r = await safeFetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, {
      trusted: true,
      timeoutMs: 15_000,
      maxBytes: 6_000_000,
      headers: { "user-agent": WIKI_UA, accept: "application/json" },
    });
    if (r.status !== 200) throw new SourceError(`Wikipedia answered ${r.status}`);
    return JSON.parse(r.body) as {
      query?: { pages?: { title: string; missing?: boolean; revisions?: { revid: number; slots: { main: { content: string } } }[] }[] };
    };
  });
  const page = data.query?.pages?.[0];
  if (!page || page.missing || !page.revisions?.[0]) throw new SourceError(`No Wikipedia article called "${title}" on ${lang}.wikipedia.org`);
  const rev = page.revisions[0];
  const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
  return build(rev.slots.main.content, "wikitext", page.title, { type: "wikipedia", lang, title: page.title, revisionId: rev.revid, url });
}

async function loadGithub(owner: string, repo: string, ref?: string, path?: string): Promise<SourceDocument> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let filePath = path;
  let branch = ref;
  if (!filePath || !/\.(md|markdown|mdx|txt|rst|html?)$/i.test(filePath)) {
    // repo root or a folder: use its README
    const sub = filePath ? `/${filePath}` : "";
    const r = await safeFetch(`https://api.github.com/repos/${owner}/${repo}/readme${sub}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`, {
      trusted: true,
      timeoutMs: 12_000,
      headers,
    });
    if (r.status === 404) throw new SourceError(`No README found in ${owner}/${repo}${sub}`);
    if (r.status !== 200) throw new SourceError(`GitHub answered ${r.status}${r.status === 403 ? " (rate limited, try again later)" : ""}`);
    const info = JSON.parse(r.body) as { path: string; download_url: string; html_url: string };
    filePath = info.path;
    branch = branch ?? info.html_url.match(/\/blob\/([^/]+)\//)?.[1] ?? "HEAD";
  }
  const raw = await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch ?? "HEAD"}/${filePath}`, {
    trusted: true,
    timeoutMs: 12_000,
    maxBytes: 3_000_000,
  });
  if (raw.status !== 200) throw new SourceError(`Could not read ${filePath} (${raw.status})`);
  const format: DocumentFormat = /\.html?$/i.test(filePath) ? "html" : /\.(md|markdown|mdx)$/i.test(filePath) ? "markdown" : detectFormat(raw.body);
  const url = `https://github.com/${owner}/${repo}/blob/${branch ?? "HEAD"}/${filePath}`;
  return build(raw.body, format, `${owner}/${repo}/${filePath}`, { type: "github", repo: `${owner}/${repo}`, path: filePath, ref: branch ?? "HEAD", url });
}

async function loadWeb(url: string): Promise<SourceDocument> {
  const r = await safeFetch(url, { timeoutMs: 15_000, maxBytes: 4_000_000 });
  if (r.status < 200 || r.status >= 300) throw new SourceError(`The page answered ${r.status}`);
  const type = r.headers.get("content-type") ?? "";
  const format: DocumentFormat = /html/i.test(type) || /<html|<body|<a\s/i.test(r.body.slice(0, 5000)) ? "html" : /markdown/i.test(type) || /\.md$/i.test(new URL(r.finalUrl).pathname) ? "markdown" : "text";
  const title = (format === "html" ? htmlTitle(r.body) : undefined) ?? new URL(r.finalUrl).hostname;
  return build(r.body, format, title, { type: "web", url: r.finalUrl }, r.finalUrl);
}

export async function loadDocument(input: ScanInput): Promise<SourceDocument> {
  switch (input.kind) {
    case "wikipedia":
      return loadWikipedia(input.lang, input.title);
    case "github":
      return loadGithub(input.owner, input.repo, input.ref, input.path);
    case "web":
      return loadWeb(input.url);
    default: {
      const format = input.format ?? detectFormat(input.text);
      const firstLine = input.text.trim().split("\n")[0]?.slice(0, 60) || "Pasted text";
      return build(input.text, format, firstLine, { type: "paste" });
    }
  }
}
