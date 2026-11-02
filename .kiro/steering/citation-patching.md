---
inclusion: auto
name: citation-patching
description: Rules for rewriting Wikipedia {{cite}} templates, Markdown and HTML links. Use when changing src/core/patch, src/core/extract, or anything that produces a diff of a user's document.
---

# Patching citations

A patch touches someone else's document. It must be reviewable at a glance and safe to paste.

## Wikitext (CS1 templates)

- Only ever set `archive-url`, `archive-date`, `url-status`. Never change `url`, `title`, `access-date` or anything else.
- Legacy `dead-url=yes|no|usurped` is rewritten in place to `url-status=…`, never duplicated.
- New parameters are appended after the last one, copying the template's style: tight `|a=b`, spaced ` |a=b`, airy ` | a = b`, or one-per-line.
- `archive-date` copies the format of the citation's own `access-date` (`6 March 2014`, `March 6, 2014`, ISO).
- `url-status` values: `dead` (buried, ghost), `usurped` (domain re-registered or parked), `unfit` (spam without registration evidence), `deviated` (changeling). CS1 hides the original link for `usurped` and `unfit`.
- If the citation already has an archive copy captured **before** the takeover, keep it; replace it only if it was captured after.
- Bracket/bare links: possessed → replace the URL with the archive URL (never leave readers one click from a squatter); others → append `{{webarchive |url= |date=}}`.

## Markdown / HTML / text

- Replace only the URL span. Archive URLs are never extracted again, so a second run is a no-op.

## Guarantees (property-tested in `tests/property/wikitext-patch.test.ts`)

1. Bytes outside the patched template are identical.
2. Parameters not being set keep their exact values.
3. The template ends up with exactly the requested values, once each.
4. Patching is idempotent.
5. The cited URL and access date survive.
