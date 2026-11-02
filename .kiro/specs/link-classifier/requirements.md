# Requirements Document

## Introduction

The link classifier extracts every cited link from a document and decides which of six states it is in: alive, buried, ghost, possessed, changeling or unknown. It must catch links that answer `200 OK` but no longer lead to the cited content, which status-code checkers report as alive.

## Glossary

- **Citation context**: the sentence in the document that the link supports.
- **Access date**: the date the author says they read the page.
- **Takeover date**: the current registration date of the link's domain, when it is later than the access date (from RDAP).

## Requirements

### Requirement 1: Extract links with their context

**User Story:** As a Wikipedia editor, I want every citation in an article found with the sentence it supports, so that each verdict is about the claim, not just the URL.

#### Acceptance Criteria

1. WHEN a wikitext document is scanned THE SYSTEM SHALL extract the `url` of every `{{cite …}}` and `{{citation}}` template, every `[http… label]` bracket link and every bare URL outside templates.
2. WHEN a citation sits inside a `<ref>` THE SYSTEM SHALL record the plain text of the sentence before that `<ref>` as the citation context.
3. WHEN a citation has `access-date`, `archive-url`, `archive-date`, `url-status` or `quote` THE SYSTEM SHALL record them, accepting ISO, `6 March 2014` and `March 6, 2014` date formats.
4. WHEN a Markdown document is scanned THE SYSTEM SHALL extract inline links, reference definitions, autolinks and bare URLs, and SHALL ignore URLs inside fenced or inline code.
5. THE SYSTEM SHALL record for every link the exact character span of the URL so that a patch can replace it without touching other bytes.
6. THE SYSTEM SHALL skip links that are already archive copies (web.archive.org, archive.today, perma.cc and similar).

### Requirement 2: Classify each link

**User Story:** As a documentation maintainer, I want to know which links now lead somewhere wrong, so that I fix the harmful ones first.

#### Acceptance Criteria

1. WHEN the server answers 404 or 410, or the domain no longer resolves, THE SYSTEM SHALL classify the link as buried.
2. WHEN the page answers 2xx and shows parking or for-sale content, THE SYSTEM SHALL classify the link as possessed.
3. WHEN the page answers 2xx with gambling or spam vocabulary that the archived copy did not have, in any of English, Indonesian, Thai, Vietnamese, Chinese, Japanese or Korean, THE SYSTEM SHALL classify the link as possessed.
4. WHEN the domain's current registration began more than 45 days after the access date and the live page shares little with the archived copy, THE SYSTEM SHALL treat it as evidence of possession and report the takeover date.
5. WHEN the link redirects to a different domain whose name is a gambling domain, THE SYSTEM SHALL classify the link as possessed, even if that server fails.
6. WHEN the page answers 2xx but its title reads as an error page, or a deep link redirects to the site's home page, or a made-up sibling URL returns the same page, THE SYSTEM SHALL classify the link as a ghost.
7. WHEN the archived copy matched the cited title or claim and the live page does not, THE SYSTEM SHALL classify the link as a changeling.
8. WHEN the site refuses automated visitors (401, 402, 403, 405, 406, 429, 451, 999) or times out twice, THE SYSTEM SHALL classify the link as unknown and say why.
9. THE SYSTEM SHALL attach to every verdict a confidence in [0, 1], a one-sentence summary and the list of evidence, each with a plain-language detail.

### Requirement 3: Be honest about what was measured

**User Story:** As a judge or user, I want to know how accurate the classifier is, so that I can trust or discount its verdicts.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a benchmark that samples citations Wikipedia editors labelled `usurped` and `live`, and classifies them without seeing the label.
2. WHEN benchmark numbers are published THE SYSTEM SHALL use a seed that was not used to tune the classifier, and SHALL publish the per-row results.
