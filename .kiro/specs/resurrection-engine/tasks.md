# Implementation Plan

- [x] 1. Network foundation
  - [x] 1.1 SSRF guard checked on every redirect hop
    - _Requirements: 4.1_
  - [x] 1.2 Bounded `safeFetch` with honest user agent and error classification
    - _Requirements: 4.3_
  - [x] 1.3 Per-host limiter; timeout starts per hop inside the slot
    - _Requirements: 4.3_
  - [x] 1.4 Cache (memory or Upstash Redis) that never stores failures
    - _Requirements: 4.2_
  - [x]* 1.5 Property test: private IPv4 always refused
    - **Property 23**
    - **Validates: Requirement 4.1**

- [x] 2. Archive selection
  - [x] 2.1 Parse CDX JSON and rank snapshots (closest, never after takeover)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Skip spam captures; step three years back when all nearby captures are spam
    - _Requirements: 1.5_
  - [x] 2.3 Keep a clean existing archive copy in the citation
    - _Requirements: 1.6_
  - [x]* 2.4 Property tests for snapshot selection
    - **Property 6, 7, 8, 9**
    - **Validates: Requirements 1.1, 1.3, 1.4**

- [x] 3. Claim verification
  - [x] 3.1 Lexical support check and best-quote finder
    - _Requirements: 2.1, 2.4_
  - [x] 3.2 Claude structured-output check with untrusted-data framing and fallback
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 3.4 Gemini provider (default when `GEMINI_API_KEY` is set) sharing one prompt, schema and quote check with Claude
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 3.3 Warn in the remedy when the copy does not support the claim
    - _Requirements: 2.5_

- [x] 4. Remedies
  - [x] 4.1 `remedyFor()` mapping verdicts to CS1 `url-status`
    - _Requirements: 3.1, 3.2, 3.3_
  - [x]* 4.2 Property test: remedy vocabulary
    - **Property 16**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 5. Next
  - [ ] 5.1 Add archive.today and Library of Congress web archives via Memento TimeTravel as fallbacks when Wayback has no clean copy
    - _Requirements: 1.5, 3.3_
  - [ ] 5.2 Offer Save Page Now for alive citations that have no archive copy yet (needs user-supplied IA keys)
    - _Requirements: 3.3_
