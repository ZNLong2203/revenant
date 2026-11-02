# Design: benchmark misses

## Root causes

| # | Root cause | Fix | Where |
|---|---|---|---|
| 1 | `cached(key, ttl, fn)` stored whatever `fn` returned, and `fn` swallowed errors into `[]` | `fn` throws `UpstreamBusy` on non-200; the caller catches outside `cached` | `net/sources.ts` (`cdx`, `listSnapshots`, `firstSeen`, `lookupDomain`) |
| 2 | `AbortSignal.timeout` created once per `safeFetch`, before `withHostLimit` waited | create the signal inside the limiter callback, per hop; one retry at 25 s | `net/fetch.ts`, `server.ts` (`liveCached`) |
| 3 | lexicon was English/Indonesian; `countHits` required non-letter neighbours | add Thai, Vietnamese, CJK and gambling brand terms; substring match for unspaced scripts | `signals/lexicon.ts` |
| 4 | registrar parking phrases missing | add `domain registered`, `dynadot`, `parkingpage`… | `signals/lexicon.ts` |
| 5 | redirect target's host name was never inspected | `isSpamHost(finalUrl)` + `crossedDomains` → possessed 0.88, in both the ok and failed branches | `signals/verdict.ts` |
| 6 | 402 fell through to "other 4xx = buried" | add 402 to the turned-away list | `signals/verdict.ts` |
| 7 | bot challenges were read as pages | `BOT_WALL_PHRASES` → unknown 0.9, stop judging | `signals/lexicon.ts`, `signals/verdict.ts` |
| 8 | sibling probe compared two identical JS shells | require ≥ 600 chars of live text | `signals/verdict.ts` |

## Properties to protect

The existing verdict properties (10–16) still hold; the regression tests in `tests/unit/takeover-patterns.test.ts` pin the six real pages.

## Measurement

Numbers are re-measured on a **new seed (4040)** that was never used for tuning; seeds 2026, 1031 and 3110 stay in `benchmark/` as development data.
