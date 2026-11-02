# Design Document: Citation Patcher

## Overview

Patching is a list of non-overlapping `TextEdit {start, end, replacement}` against the original text, applied in one pass (`applyEdits`). Edits are computed from the extractor's spans, so the patcher never re-parses free text.

- `setTemplateParams(text, span, updates)` re-parses one template, detects its style (`detectStyle`: tight, spaced, airy or multi-line, plus `name = value` spacing) and emits edits.
- `formatDateLike(iso, example)` mirrors `6 March 2014`, `March 6, 2014`, `6 Mar 2014` or ISO.
- `planFix(link, exam, takeoverDate)` decides what to write (keeps a clean existing archive), `applyFixes` builds edits per link kind, rejects overlaps, and renders the diff with jsdiff.

## Correctness Properties

All in `tests/property/wikitext-patch.test.ts` and `tests/property/extract-and-guard.test.ts`, generated over random cite templates in four spacing styles, with random parameters, access-date formats and existing status:

- **Property 1: Text outside the patched template is byte-identical.** _Validates: Requirement 1.1_
- **Property 2: Every parameter not being set keeps its exact value.** _Validates: Requirements 1.1, 1.2_
- **Property 3: After patching, the template carries exactly the requested values, once each.** _Validates: Requirements 1.2, 1.3, 1.4_
- **Property 4: Patching is idempotent.** _Validates: Requirement 1.6_
- **Property 5: The cited URL and access date survive the patch.** _Validates: Requirement 1.1_
- **Property 22: Markdown fixes only change URLs and a second pass finds nothing to fix.** _Validates: Requirements 2.1, 1.6_
