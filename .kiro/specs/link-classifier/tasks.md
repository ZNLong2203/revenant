# Implementation Plan

- [x] 1. Shared vocabulary
  - [x] 1.1 Define `Verdict`, `ExtractedLink`, `Examination`, `Evidence`, `Remedy` in `src/core/types.ts`
    - _Requirements: 2.9_
  - [x] 1.2 URL helpers: normalisation, registrable domain, root-redirect and cross-domain checks
    - _Requirements: 1.5, 2.5, 2.6_
  - [x]* 1.3 Property test: normalisation is idempotent
    - **Property 17**
    - **Validates: Requirement 1.5**

- [x] 2. Extractors
  - [x] 2.1 Wikitext template scanner with parameter spans and `claimBefore`
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [x] 2.2 Loose date parser for citation dates
    - _Requirements: 1.3_
  - [x] 2.3 Markdown extractor that skips code
    - _Requirements: 1.4, 1.5_
  - [x] 2.4 HTML outbound-anchor extractor
    - _Requirements: 1.5, 1.6_
  - [x]* 2.5 Property tests: spans slice to raw URLs; code is never extracted
    - **Property 19, 20, 21**
    - **Validates: Requirements 1.1, 1.4, 1.5**

- [x] 3. Pure decision procedure
  - [x] 3.1 Lexicon data (parking, spam, soft-404)
    - _Requirements: 2.2, 2.3, 2.6_
  - [x] 3.2 `decide()` with noisy-OR evidence and severity tie-break
    - _Requirements: 2.1–2.9_
  - [x]* 3.3 Property tests for verdict invariants
    - **Property 10–15**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.8, 2.9**

- [x] 4. Observation pipeline (`examine.ts`)
  - [x] 4.1 Live probe, RDAP and archive in parallel; archive only when suspicious
    - _Requirements: 2.4, 2.7_
  - [x] 4.2 Sibling soft-404 probe for deep links
    - _Requirements: 2.6_
  - [x] 4.3 Second decision pass after the claim check
    - _Requirements: 2.7_

- [x] 5. Benchmark against editor labels
  - [x] 5.1 `scripts/benchmark.ts`: sample `usurped` and `live` citations, label-blind examination, per-seed results
    - _Requirements: 3.1, 3.2_
  - [x] 5.2 Fix the gaps found on seeds 2026, 1031 and 3110 (see `.kiro/specs/benchmark-misses/`)
    - _Requirements: 2.3, 2.5, 2.8_
  - [x] 5.3 Publish numbers from a fresh seed only (4040) in `docs/BENCHMARK.md`
    - _Requirements: 3.2_

- [ ] 6. Next
  - [ ] 6.1 Learn per-language spam terms from benchmark rows instead of hand-curating (keep the regression tests)
    - _Requirements: 2.3_
  - [ ]* 6.2 Property test: adding spam terms that the archive also contains never flips a page to possessed
    - **Validates: Requirement 2.3**
