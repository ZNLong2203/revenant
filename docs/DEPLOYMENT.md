# Running and deploying Revenant

## Local

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # unit + property tests
npm run revenant -- scan README.md
```

Node 22 or newer.

## Environment variables

All optional. See [`.env.example`](../.env.example).

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Claim checks use Claude (default `claude-opus-5-5`) instead of word overlap |
| `REVENANT_MODEL` | Override the claim-check model, e.g. `claude-haiku-5-5` for lower cost |
| `REVENANT_LLM=off` | Force the lexical claim check |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared cache across serverless instances (Vercel KV variables also work) |
| `GITHUB_TOKEN` | Higher GitHub API limit for README lookups (read-only, no scopes needed) |
| `APP_URL` | Public URL, used for metadata and the MCP snippet on /agents |
| `REVENANT_MAX_LINKS` | Links extracted per document (default 600) |
| `REVENANT_EXAMINE_PER_HOUR`, `REVENANT_MCP_PER_HOUR` | Per-IP limits on the public endpoints |

## Vercel

1. Import the GitHub repository in Vercel (framework: Next.js, defaults are fine).
2. Add the variables you want (at least `APP_URL`; `ANTHROPIC_API_KEY` and Upstash for the full experience).
3. Deploy. `/api/examine` runs up to 60 s and `/api/mcp` up to 300 s.
4. Update `powers/revenant/mcp.json` if the deployment URL differs from `https://revenant-links.vercel.app`.

`.vercelignore` keeps `private/`, `.env*` and local caches out of the upload.

## Recorded scans and benchmark

```bash
npm run featured                                   # re-record public/featured/*.json
npm run benchmark -- --positives 80 --controls 80 --seed <unused seed>
```

Both read live services (Wikipedia, Wayback Machine, RDAP) politely and take several minutes.
