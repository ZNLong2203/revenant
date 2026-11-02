# Bugfix: benchmark misses (seeds 2026, 1031 and 3110)

The first label-blind benchmark against Wikipedia citations that editors had tagged `usurped` exposed eight defects. Each is reproduced by a test that quotes the real page.

## Current Behavior (Defect)

1. WHEN the Wayback CDX API answered 429 or timed out THEN the system cached "no snapshots" for three days, so possessed links got no archive copy for the rest of the run.
2. WHEN a document cited one host 50 times THEN the system started each fetch's timeout before the request left the per-host queue, so most of them timed out unsent (66 unknown verdicts on the PHP article, 53 of them on wiki.php.net).
3. WHEN a squatter page was written in Thai (`สล็อต PG เว็บตรง แตกหนัก RTPสูง`) THEN the system classified it as alive, because the spam lexicon covered only English and Indonesian and required word boundaries that Thai does not use.
4. WHEN a domain showed a registrar holding page (`Domain registered | Dynadot`) THEN the system classified it as a ghost, not possessed.
5. WHEN a link redirected to a gambling-named domain whose server was down (`rejekibetapkslot.com`, HTTP 521) THEN the system classified it as buried.
6. WHEN a site answered 402 (paywall) THEN the system classified it as buried.
7. WHEN a site served a bot challenge (`Client Challenge`) instead of the page THEN the system classified the link as a ghost (found on a `live`-tagged control, seed 3110).
8. WHEN a JavaScript-rendered site returned the same near-empty shell for every path THEN the sibling probe called the link a ghost (seed 3110 control).

## Expected Behavior (Correct)

1. WHEN an upstream service fails THEN the system SHALL return an empty result for this request and SHALL NOT cache it; it SHALL retry 429/503 up to twice honouring `Retry-After`.
2. WHEN requests wait in the per-host queue THEN the system SHALL start each timeout only once the request holds a slot, and SHALL retry a timed-out page once with a longer timeout.
3. WHEN a page carries gambling vocabulary in Thai, Vietnamese, Chinese, Japanese or Korean THEN the system SHALL count it like English spam, matching unspaced scripts as substrings.
4. WHEN a page is a registrar holding page THEN the system SHALL classify it as possessed.
5. WHEN a link redirects to a different domain whose name is a gambling domain THEN the system SHALL classify it as possessed, whatever that server answers.
6. WHEN a site answers 402 THEN the system SHALL classify the link as unknown.
7. WHEN a page is a bot challenge THEN the system SHALL classify the link as unknown and SHALL NOT judge it further.
8. WHEN the live page has less than 600 characters of server-rendered text THEN the system SHALL NOT use the sibling probe as evidence.

## Unchanged Behavior (Regression Prevention)

1. WHEN a page mentions one gambling word in ordinary prose (a history of the Monte Carlo Casino) THEN the system SHALL CONTINUE TO classify it as alive.
2. WHEN a page answers 404 or its domain does not resolve THEN the system SHALL CONTINUE TO classify it as buried.
3. WHEN a citation tagged `live` is examined THEN the system SHALL CONTINUE TO produce no possessed verdict on it (0 of 60 on seed 1031).
