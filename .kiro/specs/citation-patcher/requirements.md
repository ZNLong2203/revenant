# Requirements Document

## Introduction

The citation patcher turns verdicts into a reviewable change to the user's own document: a patched source and a unified diff. It runs in the browser and in the CLI. It never saves or submits anything.

## Glossary
- **CS1 template**: a Wikipedia citation template such as `{{cite web}}`, whose `url-status`, `archive-url` and `archive-date` parameters control which link readers see.
- **Patch**: the patched source plus a unified diff of it. Revenant produces it; a person applies it.

## Requirements

### Requirement 1: Minimal, faithful wikitext edits

**User Story:** As a Wikipedia editor, I want a patch that changes only what it must, so that I can review and save it with confidence.

#### Acceptance Criteria

1. WHEN a cite template is patched THE SYSTEM SHALL change only `archive-url`, `archive-date` and `url-status`, and SHALL leave every byte outside the template unchanged.
2. WHEN a parameter being set already exists THE SYSTEM SHALL rewrite its value in place, keeping the surrounding whitespace.
3. WHEN a legacy `dead-url` parameter exists THE SYSTEM SHALL rewrite it to `url-status` instead of adding a second status.
4. WHEN a parameter is missing THE SYSTEM SHALL append it in the template's existing spacing style.
5. THE SYSTEM SHALL write `archive-date` in the same format as the citation's `access-date`.
6. WHEN the same patch is applied twice THE SYSTEM SHALL produce the same text as applying it once.

### Requirement 2: Other formats

**User Story:** As a README or docs maintainer, I want fixes to Markdown, HTML and plain-text links too, so that the same tool works outside Wikipedia.

#### Acceptance Criteria

1. WHEN a Markdown, HTML or plain-text link is fixed THE SYSTEM SHALL replace only the URL with the archive URL.
2. WHEN a wikitext bracket or bare link is possessed THE SYSTEM SHALL replace the URL itself; OTHERWISE it SHALL append `{{webarchive}}`.

### Requirement 3: Review and hand-off

**User Story:** As a maintainer, I want to see and take the change in the form my workflow needs.

#### Acceptance Criteria

1. THE SYSTEM SHALL produce a unified diff with two lines of context.
2. THE SYSTEM SHALL let the user copy the patched source, download the diff or file, and open the Wikipedia or GitHub editor with a suggested edit summary.
3. THE SYSTEM SHALL list every link it did not fix and why.
4. THE SYSTEM SHALL never write to Wikipedia, GitHub or any remote service.
