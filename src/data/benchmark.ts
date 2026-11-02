/**
 * Headline benchmark numbers, copied from benchmark/results-seed4040.json
 * (`npm run benchmark -- --positives 80 --controls 80 --seed 4040`, run once
 * on 2026-11-02 after the last detector change). See /method#benchmark and
 * docs/BENCHMARK.md.
 */
export const BENCHMARK = {
  seed: 4040,
  ranOn: "2026-11-02",
  positives: 80,
  controls: 80,
  decided: 67,
  flagged: 60,
  flaggedOfDecidedPct: "90%",
  controlPossessed: "0",
  unknownPositives: 13,
  notes:
    "Most usurped-tagged domains have since died outright, so they are flagged as buried rather than possessed; the tag describes what an editor saw years ago. Of the 80 live-tagged controls, 12 were flagged buried or ghost; the three ghosts we checked by hand (old Repubblica, BendWeekly and Scotsman URLs that now land on section pages) are real soft 404s. Two misses on this seed, a \"This website is for sale!\" page and an Indonesian gambling page with brand names Revenant did not know, were fixed after the run and are not counted here.",
  headline: "60 of 67",
  caption:
    "citations Wikipedia editors had tagged as usurped were flagged by Revenant without seeing the tag, and none of 80 live-tagged citations was called possessed (held-out benchmark, seed 4040).",
};
