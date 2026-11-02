# Benchmark: Revenant against Wikipedia editors' own labels

Wikipedia editors tag citations by hand. When a cited domain has been taken over they set `url-status=usurped`; when they have checked a link and archived it they set `url-status=live`. Those tags are ground truth that Revenant can be measured against without ever seeing them.

## Method

- **Sample.** `scripts/benchmark.ts` picks English Wikipedia articles that contain at least one `url-status=usurped` citation, at random offsets through the search results (seeded). From each article it takes one random `usurped` citation (a **positive**) and one random `live` citation (a **control**). DOIs, Wikipedia and library links are excluded.
- **Label-blind.** Revenant gets the URL, citation title, citing sentence and access date. It does **not** get the `url-status` tag or the citation's existing archive link.
- **Claim check.** Lexical (no LLM), so runs are free and reproducible.
- **Seeds.** Seeds 2026, 1031 and 3110 were used to find and fix mistakes (see [`.kiro/specs/benchmark-misses`](../.kiro/specs/benchmark-misses/bugfix.md)). They are development data. The published numbers come from **seed 4040**, run once after the last detector change, on 2026-11-02.
- **Raw rows.** Every run is in [`benchmark/`](../benchmark): verdict, confidence, signals, live page title, final URL, registration date and the proposed archive date, per citation.

```bash
npm run benchmark -- --positives 80 --controls 80 --seed <n>
```

## Results (seed 4040, 80 positives, 80 controls)

| | Positives (`usurped`) | Controls (`live`) |
|---|---|---|
| possessed | 10 | **0** |
| ghost | 6 | 3 |
| changeling | 2 | 0 |
| buried | 42 | 9 |
| alive | 7 | 48 |
| unknown | 13 | 20 |

- **60 of the 67** usurped-tagged citations Revenant could judge (90%) were flagged as a problem.
- **None of the 80** live-tagged citations was called possessed, the verdict that hides a link from readers.
- Unknowns are honest: 20 × HTTP 403, 7 timeouts, 2 bot challenges, 2 × 429, 2 connection failures across both sets. Revenant does not try to get past bot checks.
- Median time per citation: 7.3 s (most of it is the Wayback Machine).

### Reading the numbers

- **Why so few "possessed" among the usurped positives?** The tag records what an editor saw, sometimes a decade ago. Most of those squatters have since let the domain lapse again, so today the link is simply dead (42 buried). Revenant reports what a reader would get *now*.
- **Controls flagged buried or ghost (12).** Live-tagged links rot too. The three ghosts were checked by hand: old Repubblica, BendWeekly and Scotsman article URLs that now redirect to section front pages. They are real soft 404s.
- **Misses.** Of the 7 positives called alive, two were clear misses: a "This website is for sale!" page and an Indonesian game-site page with brand names the lexicon did not know. Both were fixed after the run with regression tests; they are **not** counted above, and seed 4040 is now development data too.

## Development history

| Seed | Role | Positives flagged (of judged) | Controls possessed | What it taught us |
|---|---|---|---|---|
| 2026 | dev | 49 / 51 | 0 / 60 | Thai casino pages, registrar holding pages, gambling-named redirects; CDX outages were being cached |
| 1031 | dev | 43 / 47 | 0 / 60 | 402 paywalls are not dead; per-host queueing timed requests out |
| 3110 | dev | 62 / 65 | 0 / 80 | bot challenges and JavaScript shells caused false ghosts |
| **4040** | **held-out** | **60 / 67** | **0 / 80** | two new misses, fixed afterwards |

Seed 2026 ran on the very first version of the detector, before any fix.
