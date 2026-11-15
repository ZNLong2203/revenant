---
inclusion: fileMatch
fileMatchPattern: ["src/core/net/**/*.ts", "src/core/sources.ts", "src/core/server.ts", "scripts/**/*.ts"]
---

# Talking to other people's servers

Revenant visits thousands of third-party pages plus two public-interest services (the Wayback Machine and Wikipedia). Code in these files must follow these rules.

## Identity

- Always send `USER_AGENT` from `net/fetch.ts`: it names RevenantBot and links to the repo. Wikimedia APIs get `WIKI_UA` with a contact URL.
- **Never spoof a browser user agent, never solve or bypass a bot check, never rotate IPs.** A 401/402/403/429/451/999 or a Cloudflare challenge is an `unknown` verdict with the reason shown; a person decides.

## Limits

- Per-host concurrency goes through `withHostLimit` (Wayback: 3, RDAP: 4, everything else: 2).
- The fetch timeout starts when the request holds its host slot, per redirect hop, never while it waits in the queue. It covers the body too, and every body read races its own timer: an abort signal alone did not end a server that answers 200 and then goes quiet.
- CDX: retry 429/503 at most twice, honouring `Retry-After` (capped at 8 s).
- The public web app rate-limits `/api/examine`, `/api/exhume` and `/api/mcp` per IP.

## Caching

- **Never cache a failure as an answer.** Inside `cached(...)`, throw on 429/5xx/timeouts so nothing is stored; return a fallback outside the cache call.
- Live pages: 6 h, transient failures 20 min. Examinations: 12 h, `unknown` 10 min. CDX: 3 days. Snapshots: 30 days. RDAP: 7 days (404 is a stable answer).

## Safety

- Every hop of every user-supplied URL passes `assertPublicUrl` (no private, loopback, link-local or metadata addresses; ports 80/443/8080/8443 only).
- Bodies are capped (`maxBytes`), non-text bodies are not read.
- Only `trusted: true` for fixed public APIs (web.archive.org, rdap.org, api.github.com, raw.githubusercontent.com, *.wikipedia.org).
