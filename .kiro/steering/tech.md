---
inclusion: always
---

# Tech

- **Next.js 16.4** (App Router) with **Cache Components** and Partial Prefetching on. Read `node_modules/next/dist/docs/` before using a Next API: this version differs from older training data. Do not export `runtime` from routes (not allowed with Cache Components). Anything that reads `searchParams` or request data must sit under `<Suspense>`.
- **React 19.3**, **Tailwind 4** (tokens in `src/app/globals.css`, never raw hex in components).
- **TypeScript**, ES modules (`"type": "module"`). Run scripts with `tsx`.
- **zod 4** for every request body and MCP tool input.
- **@modelcontextprotocol/sdk 1.32**: `registerTool` (not the deprecated `tool`), `WebStandardStreamableHTTPServerTransport` for the HTTP route, stateless.
- **@anthropic-ai/sdk**: claim checks via `client.beta.messages.parse` with `betaZodOutputFormat`, `fallbacks: "default"`, effort `low`. Default model `claude-opus-5-5`, overridable with `REVENANT_MODEL`. Always fall back to the lexical check on any error.
- **Tests: vitest + fast-check.** Property tests live in `tests/property/`, named `Property N: <invariant>` and linked to a spec requirement. Regression tests from real pages live in `tests/unit/`. Never return the result of `expect(...)` from a fast-check predicate (a falsy return fails the property).
- **Cache**: `src/core/net/cache.ts` (memory, or Upstash Redis when configured). Never cache a failure (see `web-politeness.md`).

## Commands

```bash
npm run dev          # Next dev server
npm test             # vitest (unit + property)
npm run typecheck    # next typegen + tsc
npm run lint
npm run revenant -- scan README.md --fail-on possessed
npm run mcp          # stdio MCP server
npm run benchmark -- --positives 80 --controls 80 --seed <n>
```

## Commits

Conventional commits (`feat(scope): …`, `fix(scope): …`, `docs: …`, `test: …`, `chore: …`) with a body that says why. Never commit `private/` or `.env*`. Never add `.kiro/` to `.gitignore`.
