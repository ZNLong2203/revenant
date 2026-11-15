---
name: link-hygiene
description: Check links in Markdown, HTML or plain text before writing or publishing them, and fix the ones that came back wrong. Use when writing docs, READMEs, blog posts or reference lists, or when asked about dead or broken links.
---

# Link hygiene with Revenant

Status codes lie: a domain that expired and was bought by a squatter still answers 200 OK. Revenant's tools tell the difference.

## When to use which tool

- Adding or quoting **one URL** → `examine_link` with the URL (and `accessDate` if the source says when it was read).
- Finished editing **a document** → `scan_document` with the full text. Read `counts` and `problems`.
- User wants **fixes** → `raise_patch`; show the `diff`, and write `patched` only if the user agrees.
- Asked about **a Wikipedia article, a GitHub README or a web page** by name or URL → `scan_source`.
- Asked to audit **a Wikipedia category** for possessed citations nobody has tagged → `census_category`. It is slow: start with `limit` 3 to 5 and tell the user it can take minutes.

## Reading verdicts

| Verdict | Do this |
|---|---|
| possessed | Never link it. Use the archived copy (`remedy.archiveUrl`) or find a new source. Tell the user the domain changed hands. |
| ghost | Treat as dead: archived copy or new source. |
| changeling | The page exists but no longer says what was cited. Prefer the archived copy; mention the change. |
| buried | Archived copy or new source. |
| unknown | The site blocked automated checks or timed out. Leave the link, tell the user to check it by hand. |
| alive | Nothing to do. |

## Rules

- Do not add a link the tools call possessed, ghost or buried without telling the user.
- Quote Revenant's evidence sentences; do not paraphrase dates or hosts.
- Revenant never edits files or websites; you apply patches only with the user's consent.
