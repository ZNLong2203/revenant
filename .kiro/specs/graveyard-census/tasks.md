# Implementation Plan

- [x] 1. Census targets
  - [x] 1.1 Category members (namespace 0, paginated, limit)
    - _Requirements: 1.1, 1.4_
  - [x] 1.2 Articles linking to a domain via `list=exturlusage`
    - _Requirements: 1.2_
  - [x] 1.3 Title lists from a file or textarea
    - _Requirements: 1.3_

- [x] 2. Run engine
  - [x] 2.1 `CensusRun` model and progress store (JSON file in the CLI, localStorage in the browser; see design: no Redis)
    - _Requirements: 2.2, 2.3_
  - [x] 2.2 Article loop with cross-article URL de-duplication
    - _Requirements: 2.1_
  - [x]* 2.3 Property test C1: each URL examined at most once per run
    - **Validates: Requirement 2.1**
  - [x]* 2.4 Property test C2: resume after any prefix gives the same report
    - **Validates: Requirement 2.2**

- [x] 3. Report
  - [x] 3.1 Worklist rows with review split (≥ 2 supporting signals)
    - _Requirements: 3.1, 4.1, 4.2_
  - [x] 3.2 CSV and wikitext table exports
    - _Requirements: 3.2_
  - [x]* 3.3 Property tests C3, C4, C5
    - **Validates: Requirements 3.2, 4.2**

- [x] 4. Surfaces
  - [x] 4.1 `revenant census` CLI command
    - _Requirements: 1.4, 2.2_
  - [x] 4.2 `/census` page: start a run, watch progress, view and export the worklist
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.3 MCP tool `census_category` (read-only, capped at 50 articles)
    - _Requirements: 1.1, 1.4_

- [x] 5. First real census
  - [x] 5.1 Run on one WikiProject category and publish the totals on the home page with the date (`npm run census:publish`; two runs in docs/CENSUS.md)
    - _Requirements: 3.3_
