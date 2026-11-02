# Implementation Plan

- [x] 1. Write failing regression tests from the real pages (jaschaheifetzsociety.org, adherents.com, jaguarssp.com, fourdir.com) and multilingual vocabulary
  - _Bugfix: Current Behavior 3, 4, 5_
- [x] 2. Never cache upstream failures; retry CDX 429/503 with Retry-After
  - _Bugfix: Expected Behavior 1_
- [x] 3. Start fetch timeouts inside the per-host slot; retry timeouts once
  - _Bugfix: Expected Behavior 2_
- [x] 4. Multilingual spam lexicon with substring matching for unspaced scripts
  - _Bugfix: Expected Behavior 3; Unchanged Behavior 1_
- [x] 5. Registrar holding pages and gambling-named redirect targets are possessed
  - _Bugfix: Expected Behavior 4, 5_
- [x] 6. 402 is unknown
  - _Bugfix: Expected Behavior 6_
- [x] 7. Bot challenges are unknown; the sibling probe needs server-rendered text
  - _Bugfix: Expected Behavior 7, 8_
- [x] 8. Re-run the benchmark on a fresh seed (4040) and confirm controls stay free of possessed verdicts
  - _Bugfix: Unchanged Behavior 3_
- [x] 9. Held-out misses on seed 4040: "website is for sale" phrasing and Indonesian game-site brands, with regression tests; numbers stay as published
  - _Bugfix: Expected Behavior 9, 10_
