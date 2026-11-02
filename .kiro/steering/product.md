---
inclusion: always
---

# Product: Revenant

Revenant finds cited links that **came back wrong** and raises the original from the Internet Archive.

## The problem

Dead-link checkers ask one question: does the URL answer 200? A cited domain that expired and was bought by a squatter answers 200 too, so it is reported as alive while readers land on a casino, a parked page or malware. Wikipedia editors tag these by hand (`url-status=usurped`); 155,603 English articles carry at least one such tag (measured 2026-11-02), and nobody knows how many are untagged.

## Who it is for

- Wikipedia editors and WikiProjects maintaining citations.
- Documentation and README maintainers (GitHub, docs sites).
- Researchers, journalists and librarians checking reference lists.
- AI agents that write or edit documents with links (through MCP, the Kiro Power and the hook).

## Vocabulary (use these words exactly, in code, UI and docs)

| Verdict | Meaning | CS1 `url-status` |
|---|---|---|
| alive | page there, still what was cited | live |
| buried | 404/410, DNS gone, refused | dead |
| ghost | soft 404: 200 but empty, error text, or redirect to home | dead |
| possessed | domain changed hands: parked, for sale, spam, gambling | usurped / unfit |
| changeling | same site, cited content replaced | deviated |
| unknown | bot wall, timeout: a person must look | (none) |

## Principles

1. **Never edit anything for the user.** Revenant proposes patches; people apply them. No bot edits to Wikipedia.
2. **Evidence over vibes.** Every verdict carries the signals behind it, in plain sentences a person can check.
3. **Unknown is an honest answer.** A bot wall or timeout is `unknown`, never guessed into a verdict.
4. **Never resurrect a squatter.** An archived copy captured after the takeover is a copy of the spam; never point to it.
5. **Be a good citizen of the web.** Identify as a bot, respect limits, never circumvent bot checks (see `web-politeness.md`).
6. **Quote real numbers only.** Every number on the site is measured and dated; the benchmark method is public.
