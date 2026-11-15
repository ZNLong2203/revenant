# Implementation Plan: Citation Patcher

## Overview

Edit citation templates byte-faithfully first, then plan fixes for every link kind, then hand the result to a person as a diff, a file or an editor link.

## Tasks

- [x] 1. Template editing
  - [x] 1.1 `setTemplateParams` with in-place rewrite, legacy alias handling and style-matched append
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 `formatDateLike` for archive dates
    - _Requirements: 1.5_
  - [x] 1.3 `applyEdits` with overlap detection
    - _Requirements: 1.1_
  - [x]* 1.4 Property tests 1–5 over generated templates
    - **Validates: Requirements 1.1–1.6**

- [x] 2. Fix planning across formats
  - [x] 2.1 `planFix` (keep clean existing archive, warn-only usurped without archive)
    - _Requirements: 1.1_
  - [x] 2.2 Per-kind edits: cite templates, bracket/bare links, Markdown/HTML/text URLs
    - _Requirements: 2.1, 2.2_
  - [x]* 2.3 Property test 22: Markdown fixes are idempotent and URL-only
    - **Validates: Requirement 2.1**

- [x] 3. Hand-off
  - [x] 3.1 Unified diff via jsdiff, skipped list with reasons
    - _Requirements: 3.1, 3.3_
  - [x] 3.2 Raise panel: copy, download, open editor with edit summary
    - _Requirements: 3.2, 3.4_

- [ ] 4. Next
  - [ ] 4.1 Open a GitHub pull request from the CLI with the user's own `gh` login (never a server token)
    - _Requirements: 3.2, 3.4_

## Notes

- Tasks marked `*` are property tests (Properties 1–5 and 22).
- Task 4.1 is open: a pull request would be opened with the user's own `gh` login, never with a server token.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1.1",
        "1.2",
        "1.3"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "1.4",
        "2.1"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "2.2"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "2.3",
        "3.1"
      ]
    },
    {
      "id": 4,
      "tasks": [
        "3.2"
      ]
    },
    {
      "id": 5,
      "tasks": [
        "4.1"
      ]
    }
  ]
}
```
