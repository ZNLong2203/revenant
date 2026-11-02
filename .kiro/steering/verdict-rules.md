---
inclusion: fileMatch
fileMatchPattern: ["src/core/signals/**/*.ts", "src/core/examine.ts", "tests/unit/takeover-patterns.test.ts", "tests/property/verdict.test.ts"]
---

# Changing how verdicts are decided

`decide()` in `src/core/signals/verdict.ts` is pure. Keep it that way: observations in, `Decision` out, no I/O.

## Invariants (each is a property test in `tests/property/verdict.test.ts`)

- 404/410 is always `buried`; DNS failure is always `buried`.
- A page that answered is never `buried`; a page that failed is never `alive`.
- A parked page (2+ parking phrases) is never `alive`.
- Gambling spam the archived copy never had makes a page `possessed`.
- Confidence stays in [0, 1]; every verdict has a one-sentence summary.
- `possessed` remedies use `usurped` or `unfit`; `changeling` uses `deviated`.

## Adding or tuning a signal

1. Start from a **real page** that was misjudged (benchmark row, user report). Record its URL and live title.
2. Add a failing regression test to `tests/unit/takeover-patterns.test.ts` quoting that title.
3. Change the lexicon (`lexicon.ts`, data only) before changing weights (`verdict.ts`).
4. Weights are noisy-OR evidence in [0, 1]. Above 0.85 means "a person would agree on sight". `alive` must beat problems by 0.15 to win.
5. Evidence `detail` is one plain sentence a reader can verify, with the concrete value (date, host, phrase).
6. Run `npm test`, then the benchmark on a **new seed**. Seeds used to find a gap are development data; never quote them as results.

## Lexicon rules

- Scripts without spaces (Thai, CJK) match as substrings; everything else needs word boundaries.
- Spam is judged relative to the archived copy (`spamJump`), so a page that always mentioned "casino" stays alive.
- Never add a phrase that a legitimate page in the same language would commonly use on its own.
