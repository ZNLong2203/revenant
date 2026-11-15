# Requirements Document

## Introduction

Revenant should catch possessed links where they are written, not months later. The same engine is exposed to people (web app, CLI), to agents (MCP over stdio and HTTP, a Kiro Power) and to automation (agent hook, GitHub Action).

## Glossary
- **MCP**: Model Context Protocol, the way agents call Revenant's tools.
- **Power**: a Kiro package that bundles an MCP server and skills, activated by keywords in the conversation.
- **Hook**: a Kiro rule that runs a command or prompt when an event happens, such as saving a file.

## Requirements

### Requirement 1: MCP server

**User Story:** As an agent author, I want link checks as MCP tools, so that my agent can verify links before it writes them.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose `examine_link`, `scan_document`, `scan_source`, `raise_patch` and `census_category` with zod-validated inputs and read-only, open-world annotations.
2. THE SYSTEM SHALL serve the same tools over stdio (`bin/revenant-mcp.ts`) and stateless Streamable HTTP (`/api/mcp`).
3. WHEN `raise_patch` is called THE SYSTEM SHALL return the patched text and a unified diff and SHALL NOT write any file.
4. WHEN the HTTP endpoint is called more than its hourly limit from one IP THE SYSTEM SHALL answer 429 with Retry-After.

### Requirement 2: Kiro Power

**User Story:** As a Kiro user, I want to add Revenant to any project in one step, so that my agent checks citations without installing anything.

#### Acceptance Criteria

1. THE SYSTEM SHALL ship a Power (`powers/revenant/`) with `plugin.json`, an `mcp.json` that points at the hosted HTTP endpoint, and skills that teach the agent when to call each tool.
2. WHEN the conversation mentions dead links, citations, link rot, Wikipedia references or archive links THE SYSTEM SHALL activate through the Power's keywords.

### Requirement 3: CLI and hook

**User Story:** As a maintainer, I want a command that fails CI or warns my agent when a possessed link is added.

#### Acceptance Criteria

1. WHEN `revenant scan` finds a verdict listed in `--fail-on` THE SYSTEM SHALL exit with code 1; usage errors exit 2; otherwise 0.
2. WHEN `--fix` is given for a local file THE SYSTEM SHALL rewrite that file with the patch; `--diff` SHALL print the diff.
3. WHEN `revenant hook` receives a hook payload on stdin THE SYSTEM SHALL scan the Markdown, wikitext or HTML files the payload names and print one line per problem, and SHALL always exit 0 so the agent is informed, not blocked.
4. THE SYSTEM SHALL persist its cache between CLI runs.

### Requirement 4: Continuous integration

**User Story:** As a maintainer, I want pull requests checked for possessed links and the code checked on every change, so that a takeover or a regression never lands unnoticed.

#### Acceptance Criteria

1. WHEN a pull request changes Markdown files THE SYSTEM SHALL scan them and fail the check on possessed links.
2. WHEN code changes THE SYSTEM SHALL run typecheck, lint and the full test suite including property tests.
