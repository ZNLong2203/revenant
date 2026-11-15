# Graveyard census: runs, results and caveats
A census runs Revenant's examination over many Wikipedia articles and lists the possessed citations nobody has tagged. How it works is in [ARCHITECTURE.md](ARCHITECTURE.md#graveyard-census) and the spec `.kiro/specs/graveyard-census`. This page records the runs that were published and what they do and do not show.

## Runs
Both runs were made on 2026-11-15 with Revenant 0.1.0. The claim check was word overlap (no model key), so a rerun gives the same rows except where the live web has changed.

| | Category:Defunct websites | Category:PHP |
|---|---|---|
| Command | `npm run census -- "Category:Defunct websites" --limit 60` | `npm run census -- "Category:PHP" --limit 50` |
| Articles | first 60 of 274, in category order | all 26 |
| Citations (links found) | 1,297 | 732 |
| Distinct URLs examined | 1,241 | 667 |
| possessed / changeling / ghost | 14 / 12 / 35 | 1 / 11 / 7 |
| buried / unknown / alive | 144 / 310 / 726 | 92 / 56 / 500 |
| **Untagged possessed citations** | **12** (0.93% of citations) | **0** |
| Possessed already tagged by editors | 3 | 1 |
| Rows on the worklist / in review | 10 / 40 | 8 / 10 |
| Links not checked (per-article limit) | 0 | 0 |

Rows are in [`census/`](../census): `<run id>.csv`, a wikitext table for a WikiProject page (`<run id>.wiki.txt`) and, for Defunct websites, the hand checks (`.checks.json`). Run ids: `defunct-websites-20261115-1irr3c5` and `php-20261115-195ar1`.

### Hand checks of the untagged possessed rows
No row had two independent signals (the spam terms alone, a new registration date alone, or a parked page alone), so by the census rules all 12 sit in the review list rather than the main worklist. Each distinct URL was then opened on the live web with the RevenantBot user agent and its final address and page title were read.

| Confirmed (9 rows) | What the live page is |
|---|---|
| abcnews.com.co (2 rows) | redirects to an Indonesian toto/togel gambling site |
| trimfeed.com | redirects to an Indonesian slot-gambling site |
| eq.org.nz | redirects to a site titled "Mafia Casino Australia" |
| itnews.it | "This website is for sale!" |
| aljazeerausannouncement.com | redirects to an unrelated biography site |
| uftree.com | redirects to a hotel site |
| fractalcow.com (2 rows) | redirects to a hotel page titled with the old domain |

| Not confirmed (3 rows) | Why |
|---|---|
| aiqinhai.org (2 rows) | answers 200 with a blank page; the domain was registered again on 2026-10-27 |
| seo-article.com | still an SEO-articles site, registered again in 2025; the page is replaced content, not a squatter |

"Confirmed" means the address now belongs to someone else. It is a reading of the live page by one person on one day, not a ruling by Wikipedia editors.

## Why these two categories
`Category:PHP` was run first because the project's demo article is about PHP. `Category:Defunct websites` was chosen next, **before** its results were known, because sites that shut down are where domains lapse and get bought. Both runs are published. `Category:PHP` was run twice, the second time after the claim-text fix below; the counts were the same and the second run is the one published. The Defunct websites run was interrupted at article 44 by the stalled link described below and resumed from its saved progress. Two small smoke tests (two articles of `Category:Internet Archive` with six links each, and the `PHP` article alone) were run to check the tool and are not published.

## What the numbers do not show
- **Not a random sample.** Defunct websites over-represents squatting, and the first 60 articles in category order are not a random 60. Do not read 0.93% as a Wikipedia-wide rate.
- **A lower bound, in one direction.** 310 of the 1,241 distinct URLs (25%) in the Defunct run were `unknown`: bot walls, timeouts and 403s. Revenant does not get past those, so any possessed link behind one is missed.
- **Two kinds of "possessed" evidence are weak alone.** A new registration date can also mean a legitimate owner change; spam terms alone depend on the archived copy being clean. That is why such rows go to review, and why three of the twelve could not be confirmed.
- **Buried links are counted but not listed**: 144 here. Existing tools find them.
- **Live web, one day.** Squatters change what their pages say, and domains are re-registered; rerunning later gives different rows.
- **The first citation speaks for a URL.** A URL is examined once per census; the claim check belongs to the first citation of it.

## Bugs the census found
- A server that answered 200 and then never finished its body held the whole run on one link (`zeusnews.it`). Response bodies now have a hard deadline, and the census gives up on any single examination after two minutes. Regression tests: `tests/unit/fetch-deadline.test.ts` and `tests/unit/census-run.test.ts`.
- Citations inside infoboxes and `{{Reflist}}` have no sentence of their own; the worklist showed template text such as `| released =`. It now shows `Cited page: "<title>"` instead.

## Reproduce
```bash
npm run census -- "Category:Defunct websites" --limit 60 --csv worklist.csv
npm run census -- --resume <run id>            # after an interruption
npm run census:publish -- <run id>             # needs a finished run; updates the home page numbers
```
A run takes about one second per distinct URL at four at a time and is gentle on the Internet Archive (three requests at once, with a circuit breaker).
