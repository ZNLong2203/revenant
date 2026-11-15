# Requirements Document

## Introduction

For every link that is not alive, the resurrection engine finds the archived copy that best represents what the author cited, checks that it actually supports the citing sentence, and proposes a fix in Wikipedia's CS1 vocabulary.

## Glossary
- **Snapshot**: one Wayback Machine capture of a URL, identified by a 14-digit timestamp.
- **Takeover date**: the current registration date of a domain from RDAP, when it is later than the date the page was cited.
- **Claim check**: a test of whether a page's text supports the sentence that cites it.

## Requirements

### Requirement 1: Choose the right archived copy

**User Story:** As an editor, I want the archived copy that matches what the author read, so that the restored citation still supports the sentence.

#### Acceptance Criteria

1. WHEN an access date is known THE SYSTEM SHALL prefer the Wayback Machine capture closest to it; on equal distance the earlier capture wins.
2. WHEN no access date is known THE SYSTEM SHALL prefer the latest clean capture.
3. THE SYSTEM SHALL only choose captures with HTTP 200 and an HTML, PDF or plain-text body.
4. WHEN a takeover date is known THE SYSTEM SHALL never choose a capture taken on or after it.
5. WHEN a candidate capture is itself spam THE SYSTEM SHALL skip it; WHEN all nearby candidates are spam THE SYSTEM SHALL search again three years before the earliest spam capture.
6. WHEN the citation already has an archive copy taken before the takeover THE SYSTEM SHALL keep it.

### Requirement 2: Verify the claim

**User Story:** As a reader, I want restored citations to support the sentence they are attached to, so that a resurrected link is not just a different dead end.

#### Acceptance Criteria

1. WHEN an archived copy is found for a non-alive link THE SYSTEM SHALL judge whether its text supports the citing sentence: supported, partial, unsupported or unknown.
2. WHEN a Gemini or Anthropic API key is configured THE SYSTEM SHALL use that model (Gemini first) with a JSON schema and treat page text as untrusted data; OTHERWISE THE SYSTEM SHALL use a word-overlap check.
3. WHEN the model call fails or is declined THE SYSTEM SHALL fall back to the word-overlap check and say so.
4. THE SYSTEM SHALL return a short verbatim quote from the archived text that backs the claim, when one exists.
5. WHEN the archived copy does not clearly support the claim THE SYSTEM SHALL say so next to the proposed fix.

### Requirement 3: Propose a remedy

**User Story:** As a Wikipedia editor, I want each problem link paired with the `url-status` value and archive copy to use, so that I can fix the citation in Wikipedia's own vocabulary.

#### Acceptance Criteria

1. WHEN a link is possessed THE SYSTEM SHALL propose `url-status=usurped` (registration or parking evidence) or `unfit` (spam only), which hides the original link.
2. WHEN a link is buried or a ghost THE SYSTEM SHALL propose `url-status=dead`; WHEN it is a changeling, `url-status=deviated`.
3. WHEN no usable archived copy exists THE SYSTEM SHALL say the citation needs a new source instead of proposing an archive.

### Requirement 4: Be polite and safe on the network

**User Story:** As an operator of a public service Revenant visits, I want it to identify itself, respect limits and never be turned against private networks, so that running it harms nobody.

#### Acceptance Criteria

1. THE SYSTEM SHALL refuse to fetch private, loopback, link-local or metadata addresses on every redirect hop.
2. THE SYSTEM SHALL never store an upstream failure (429, 5xx, timeout) in the cache as an answer.
3. THE SYSTEM SHALL limit concurrent requests per host and start each request's timeout only when it holds its slot.
