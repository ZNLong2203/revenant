# How this repository uses Kiro

Everything Kiro reads lives in [`/.kiro`](../.kiro). This page explains what each piece is for and how to use it.

## Steering: `.kiro/steering/`

| File | Inclusion | Why it exists |
|---|---|---|
| `product.md` | always | The vocabulary (alive, buried, ghost, possessed, changeling, unknown) and its mapping to Wikipedia's `url-status`, plus the principles: never edit for the user, evidence over vibes, never resurrect a squatter. |
| `tech.md` | always | Next.js 16 with Cache Components differs from older training data. This file states the rules that broke first (no `runtime` export, Suspense around runtime data), the SDK calls to use, and the fast-check pitfall of returning `expect(...)` from a predicate. |
| `structure.md` | always | Where things live, and the import rules that keep `src/core` browser-safe. |
| `web-politeness.md` | fileMatch `src/core/net/**`, `sources.ts`, `server.ts`, `scripts/**` | Loaded only when the agent touches code that talks to other people's servers: honest user agent, per-host limits, no cached failures, SSRF rules. |
| `verdict-rules.md` | fileMatch `src/core/signals/**`, `examine.ts`, verdict tests | The invariants of the decision procedure and the workflow for changing it: start from a real misjudged page, write the regression test first, re-measure on a fresh seed. |
| `ui-voice.md` | fileMatch `src/app/**`, `src/components/**` | Theme rules that keep the Halloween look from hurting usability: verdicts are never colour alone, plain English before atmosphere, no invented numbers. |
| `citation-patching.md` | auto (by description) | CS1 template rules, pulled in when the conversation is about patching citations. |

## Specs: `.kiro/specs/`

| Spec | Type | Notes |
|---|---|---|
| `link-classifier` | feature | EARS requirements for extraction and the six verdicts; the design lists Correctness Properties 10–21 and the decision table. |
| `resurrection-engine` | feature | Archive selection ("never after the takeover"), claim verification, remedies, network safety; Properties 6–9, 16, 23. |
| `citation-patcher` | feature | Byte-preserving wikitext edits; Properties 1–5 and 22. |
| `agent-surfaces` | feature | MCP tools, CLI, hook, Power, CI. |
| `benchmark-misses` | **bugfix** | Eight real defects found by benchmarking against Wikipedia editors' own labels, in Current / Expected / Unchanged form. |
| `graveyard-census` | feature, **open** | The next feature: census a Wikipedia category and publish a worklist of untagged possessed citations. All tasks are open. |

Every property in a design document is a real test: `Property N` in the design is `it("Property N: …")` in `tests/property/`.

## Hooks: `.kiro/hooks/` (v1 JSON)

| Hook | Trigger | Action |
|---|---|---|
| `core-tests-on-save` | PostFileSave `src/core/**`, `tests/**` | `vitest run`: property tests on every engine edit |
| `typecheck-ui-on-save` | PostFileSave `src/app/**`, `src/components/**` | `next typegen && tsc --noEmit` |
| `docs-link-check` | PostFileSave `*.md` | **Revenant checks the links the agent just wrote** (`revenant hook` reads the payload on stdin) |
| `signal-change-needs-evidence` | PostFileSave `src/core/signals/**` | agent prompt: name the real page, keep the invariants, pick an unused seed |
| `guard-bot-etiquette` | PreToolUse `shell` | blocks spoofed browser user agents, anti-bot tooling and staging `private/` or `.env` |
| `spec-task-verify` | PostTaskExecution | tests after each spec task |
| `stop-run-tests` | Stop (with confirm) | offers typecheck + lint + tests before the agent hands back |

## Custom agents: `.kiro/agents/`

- `gravedigger.json`: read-only; scans the repo's own Markdown through Revenant's MCP tools and proposes patches. Writes and shell are denied by permission rules.
- `verdict-reviewer.md`: reviews diffs to the verdict logic against `verdict-rules.md` and ends with SHIP / SHIP WITH NOTES / HOLD. Shell is limited to `git diff`, `git log` and the tests.

## MCP: `.kiro/settings/mcp.json`

- `revenant` (stdio): the project's own server, so Kiro can check links while it writes docs.
- `context7` (remote): current library documentation (Next 16, MCP SDK) instead of stale memory.

## Power: `powers/revenant/`

`plugin.json` + `mcp.json` (the hosted HTTP endpoint) + two skills (`link-hygiene`, `wikipedia-citations`). Import it in Kiro's Powers panel from this repository's GitHub URL; it activates on keywords such as "dead link", "citation", "link rot" and "wikipedia".

## Property-based testing

`tests/property/` holds 23 fast-check properties, numbered to match the spec designs. Two found real bugs while the engine was being built:

- **Property 17** (URL normalisation is idempotent) shrank to `http://a.aa?#`: an empty query left a dangling `?` that a second pass stripped. The fix iterates normalisation to a fixed point.
- The same run showed that returning `expect(...)` from a predicate makes fast-check report a false failure, which is now a rule in `tech.md`.
