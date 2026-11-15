# Requirements Document

## Introduction

The Graveyard Census scans a whole set of Wikipedia articles (a category, a WikiProject's article list, or the articles linking to one domain) and publishes a worklist of **possessed citations nobody has tagged yet**, so WikiProjects can clean them up. It turns Revenant from a one-article tool into a measurable public good.

## Glossary

- **Untagged possessed citation**: a citation Revenant classifies as possessed whose `url-status` is not already `usurped` or `unfit`.
- **Census run**: one scan of a fixed list of articles at a fixed time, stored with its parameters.

## Requirements

### Requirement 1: Choose what to count

**User Story:** As a WikiProject coordinator, I want to census the articles my project looks after, so that I get a worklist that fits our scope.

#### Acceptance Criteria

1. WHEN the user gives a category name THE SYSTEM SHALL list its articles (namespace 0) through the MediaWiki API, up to a configurable limit (default 200).
2. WHEN the user gives a domain THE SYSTEM SHALL list the articles that link to it through `list=exturlusage`.
3. WHEN the user gives a list of titles THE SYSTEM SHALL use it as is.
4. THE SYSTEM SHALL refuse a census larger than 2,000 articles in the hosted app and point to the CLI.

### Requirement 2: Run politely and resumably

**User Story:** As a WikiProject coordinator, I want a long census to be gentle on the services it reads and to survive interruptions, so that I can run it on hundreds of articles.

#### Acceptance Criteria

1. THE SYSTEM SHALL examine one article at a time with the existing per-host limits, and SHALL NOT examine a URL twice in one census.
2. WHEN a census is interrupted THE SYSTEM SHALL resume from the last finished article.
3. THE SYSTEM SHALL record the start time, parameters, Revenant version and counts for each run.

### Requirement 3: Publish a worklist

**User Story:** As an editor, I want a sortable worklist with evidence and a ready fix for each citation.

#### Acceptance Criteria

1. THE SYSTEM SHALL list untagged possessed citations first, then ghosts and changelings, each with article, claim, URL, evidence summary and the proposed citation fix.
2. THE SYSTEM SHALL let the user export the worklist as CSV and as wikitext (a table suitable for a WikiProject page).
3. THE SYSTEM SHALL show census totals: articles, citations examined, verdict counts, untagged possessed count and share of citations affected.
4. THE SYSTEM SHALL never edit Wikipedia.

### Requirement 4: Verify before publishing

**User Story:** As an editor, I want every listed citation backed by enough evidence and a checked archive copy, so that I do not waste time on false alarms.

#### Acceptance Criteria

1. WHEN a census reports an untagged possessed citation THE SYSTEM SHALL have a claim check and an archive copy for it, or mark it "needs a new source".
2. WHEN fewer than 2 independent signals support a possessed verdict THE SYSTEM SHALL place it in a "review" section instead of the main worklist.
