# Implementation Plan: Agent Surfaces

## Overview

Expose the engine to agents and automation: shared MCP tools over two transports, the CLI and hook, the Kiro integration in this repository, the Power and CI.

## Tasks

- [x] 1. MCP tools shared by both transports
  - [x] 1.1 `createRevenantServer` with four tools and annotations
    - _Requirements: 1.1, 1.3_
  - [x] 1.2 stdio entry point
    - _Requirements: 1.2_
  - [x] 1.3 `/api/mcp` stateless Streamable HTTP route with per-IP limit
    - _Requirements: 1.2, 1.4_
  - [x]* 1.4 Unit test: tool list and annotations
    - _Requirements: 1.1_

- [x] 2. CLI
  - [x] 2.1 `scan`, `check`, `hook` commands with exit codes and disk cache
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x]* 2.2 Unit test: hook payload parsing
    - _Requirements: 3.3_

- [x] 3. Kiro integration in this repo
  - [x] 3.1 `.kiro/settings/mcp.json` with the stdio server
    - _Requirements: 1.2_
  - [x] 3.2 `.kiro/hooks/docs-link-check.json` running `revenant hook` on Markdown saves
    - _Requirements: 3.3_

- [x] 4. Kiro Power
  - [x] 4.1 `powers/revenant/plugin.json`, `mcp.json`, skills `link-hygiene` and `wikipedia-citations`
    - _Requirements: 2.1, 2.2_
  - [x] 4.2 Install the Power from the public GitHub repo (`kiro-cli powers install`), see it under Installed in Kiro's Powers panel, and record the activation in a project that has nothing to do with Revenant (`private/kiro-logs/power.md`)
    - _Requirements: 2.1, 2.2_

- [x] 5. CI
  - [x] 5.1 `.github/workflows/ci.yml`: typecheck, lint, test
    - _Requirements: 4.2_
  - [x] 5.2 `.github/workflows/revenant.yml`: scan changed Markdown, fail on possessed
    - _Requirements: 4.1_

## Notes

- Tasks marked `*` are unit tests.
- Task 4.2 is open: the Power was installed from a clone of the public repository with `kiro-cli powers install` and used in Kiro IDE, but not yet imported through the Powers panel or recorded for the demo.
- `census_category` was added later by the graveyard-census spec.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1.1",
        "2.1"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "1.2",
        "1.3",
        "1.4",
        "2.2",
        "5.1"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "3.1",
        "3.2",
        "4.1",
        "5.2"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "4.2"
      ]
    }
  ]
}
```
