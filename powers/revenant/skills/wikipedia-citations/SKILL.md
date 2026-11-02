---
name: wikipedia-citations
description: Audit and repair the citations of a Wikipedia article or any wikitext with {{cite}} templates. Use when the user mentions Wikipedia references, url-status, archive-url, usurped links or WikiProject cleanup.
---

# Wikipedia citations

1. Call `scan_source` with `wiki:<Title>` (or the article URL). For long articles pass `maxLinks` up to 150 and say that the rest were not checked.
2. Report possessed citations first: these send readers to someone else's site, and CS1 hides them with `url-status=usurped` (domain re-registered or parked) or `unfit` (spam).
3. For fixes, call `raise_patch` with the article's wikitext and `format: "wikitext"`. Revenant only sets `archive-url`, `archive-date` (in the citation's own date style) and `url-status`; every other byte is unchanged.
4. Give the user the diff and a suggested edit summary. Never claim the article was edited: the user saves it themselves. Bot-like mass editing on Wikipedia needs community approval.

Verdict → `url-status`: buried/ghost → `dead`, possessed → `usurped`/`unfit`, changeling → `deviated`.
