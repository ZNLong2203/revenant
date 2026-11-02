---
inclusion: always
---

# Structure

```
src/core/            the engine, shared by web, CLI and MCP (no Next imports)
  types.ts           vocabulary: Verdict, ExtractedLink, Examination, Remedy
  extract/           wikitext, markdown, html extractors (exact source spans)
  signals/           lexicon.ts (phrase data) + verdict.ts (pure decision)
  archive/select.ts  snapshot ranking (pure)
  patch/             citation patcher + unified diff (pure, runs in the browser)
  claim/             lexical.ts (pure) + llm.ts (Claude, server-only)
  net/               fetch (SSRF guard, limits), cache, RDAP + Wayback sources
  examine.ts         one link end to end, network injected (testable)
  server.ts          production wiring + caching
  scan.ts            whole-document scan for CLI and MCP
  sources.ts         load Wikipedia / GitHub / web / paste
src/mcp/tools.ts     MCP tool definitions (stdio + HTTP)
src/app/             pages (/, /scan, /method, /agents) and API routes
src/components/      UI; scan/ holds the scan view, autopsy, raise panel
bin/                 revenant.ts (CLI) and revenant-mcp.ts (stdio MCP)
scripts/             benchmark.ts, featured.ts, hooks/
powers/revenant/     the Kiro Power (plugin.json, mcp.json, skills/)
tests/property/      fast-check properties, one file per spec area
tests/unit/          regression tests from real pages
benchmark/           committed benchmark results (raw caches ignored)
docs/                public documentation
private/             gitignored: submission drafts, demo script, video
```

Rules:
- `src/core/**` must not import from `src/app`, `src/components` or `next/*`.
- Pure modules (`extract`, `signals`, `archive`, `patch`, `claim/lexical`, `text`, `url`, `dates`, `group`) must not import `node:*` or `net/*`: the browser bundles them.
- New network access goes through `net/fetch.ts` (`safeFetch`), never raw `fetch`.
