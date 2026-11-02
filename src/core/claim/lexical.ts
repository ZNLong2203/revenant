/**
 * Offline claim check: does the page text carry the words of the citing
 * sentence (or the citation's own quote/title)? Used when no LLM key is set,
 * and as a cheap pre-filter before the LLM.
 */
import type { ClaimCheck, ClaimSupport } from "../types";
import { clip, coverage, tokens } from "../text";

export function lexicalSupport(claim: string, pageText: string, quote?: string, title?: string): ClaimSupport {
  if (!pageText.trim()) return "unknown";
  if (quote && quote.length > 20) {
    const q = coverage(quote, pageText);
    if (q >= 0.85) return "supported";
  }
  const c = claim ? coverage(claim, pageText) : 0;
  const t = title ? coverage(title, pageText) : 0;
  if (tokens(claim).length < 4) {
    return t >= 0.7 ? "partial" : t >= 0.3 ? "unknown" : "unsupported";
  }
  if (c >= 0.6) return "supported";
  if (c >= 0.35 || t >= 0.7) return "partial";
  return "unsupported";
}

/** The best matching sentence from the page, as evidence for a person. */
export function bestQuote(claim: string, pageText: string, max = 240): string | undefined {
  const sentences = pageText.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30 && s.length < 800);
  let best: { s: string; score: number } | undefined;
  for (const s of sentences) {
    const score = coverage(claim, s);
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 0.25 ? clip(best.s, max) : undefined;
}

export function lexicalCheck(input: {
  claim: string;
  archiveText?: string;
  liveText?: string;
  quote?: string;
  title?: string;
}): ClaimCheck {
  const archive = input.archiveText ? lexicalSupport(input.claim, input.archiveText, input.quote, input.title) : "unknown";
  const live = input.liveText ? lexicalSupport(input.claim, input.liveText, input.quote, input.title) : undefined;
  const quote = input.archiveText ? bestQuote(input.claim, input.archiveText) : undefined;
  return {
    archive,
    live,
    quote,
    method: "lexical",
    rationale:
      archive === "supported"
        ? "The archived copy uses most of the words of the cited sentence."
        : archive === "partial"
          ? "The archived copy shares some of the cited sentence's words or its title."
          : archive === "unsupported"
            ? "The archived copy shares few words with the cited sentence. A person should confirm it is the right source."
            : "There was no archived text to compare.",
  };
}
