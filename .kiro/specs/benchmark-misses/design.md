# Bugfix Design: benchmark misses

## Overview

The first label-blind benchmark runs (seeds 2026, 1031, 3110) and the held-out run (seed 4040) exposed ten defects, listed in `bugfix.md`. Each one was reproduced first with a regression test quoting the real page, then fixed where its root cause lay, then re-measured on a seed that had not been used for tuning.

## Glossary

- **Seed**: the random seed that picks which Wikipedia articles and citations a benchmark run samples. A seed used to find and fix mistakes is development data and is never quoted as a result.
- **Positive / control**: a citation editors tagged `url-status=usurped` / `url-status=live`.

## Bug Details

The defects fall into four groups: failures cached as answers (1), timeouts started too early (2), vocabulary the lexicon did not know (3, 4, 9, 10), and pages read as something they were not (5–8). The pages that exposed them are quoted in `tests/unit/takeover-patterns.test.ts`.

## Expected Behavior

As in `bugfix.md` § Expected Behavior: upstream failures are never cached, timeouts start inside the per-host slot, multilingual and registrar vocabulary counts, gambling-named redirect targets and "for sale" pages are possessed, 402 and bot challenges are unknown, and the sibling probe needs real server-rendered text.

## Hypothesized Root Cause

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
| 9, 10 | "website is for sale" phrasing and two Indonesian game-site brands were missing | add the phrases and brands | `signals/lexicon.ts` |

## Correctness Properties

The existing verdict properties still hold and protect the unchanged behaviour.

### Property 10: A 404 or 410 is always buried
**Validates: Requirements 2.1**

### Property 13: Turning a page into a parked domain never leaves it alive
**Validates: Requirements 2.2**

### Property 14: A gambling takeover the archive never had is possessed
**Validates: Requirements 2.3**

These refer to `.kiro/specs/link-classifier/requirements.md`.

## Fix Implementation

Fixes 1–8 landed before the held-out run; fixes 9 and 10 after it, so the published seed 4040 numbers do not include them. A later review of fix 9 by the `verdict-reviewer` agent found that "this website is for sale" and "website is for sale" are nested phrases, so one sentence counts twice towards the two-phrase parking threshold. That is not fixed yet; changing the lexicon needs a fresh benchmark seed.

## Testing Strategy

Each defect has a regression test quoting its real page in `tests/unit/takeover-patterns.test.ts`, written to fail before the fix. The benchmark is then re-run on a new seed, and the controls must stay free of possessed verdicts (0 of 80 on seed 4040).
