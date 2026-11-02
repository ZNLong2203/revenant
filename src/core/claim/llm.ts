/**
 * Which model checks claims. Gemini is the default when GEMINI_API_KEY is
 * set; Claude is used when only ANTHROPIC_API_KEY is set; without either,
 * Revenant uses the word-overlap check. Server-only.
 *
 *   REVENANT_LLM    = auto (default) | gemini | anthropic | off
 *   REVENANT_MODEL  = override the model id for the chosen provider
 */
import type { ClaimCheck } from "../types";
import { anthropicClaimCheck, DEFAULT_CLAUDE_MODEL } from "./anthropic";
import { DEFAULT_GEMINI_MODEL, geminiClaimCheck } from "./gemini";
import { lexicalCheck } from "./lexical";
import type { ClaimInput } from "./prompt";

export type { ClaimInput } from "./prompt";

export interface ClaimProvider {
  provider: "gemini" | "anthropic";
  model: string;
}

type Env = Record<string, string | undefined>;

/** Pure: pick the provider from environment variables. */
export function claimProvider(env: Env = process.env): ClaimProvider | null {
  const choice = (env.REVENANT_LLM ?? "auto").toLowerCase();
  if (choice === "off") return null;
  const gemini = env.GEMINI_API_KEY ? { provider: "gemini" as const, model: env.REVENANT_MODEL || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL } : null;
  const claude = env.ANTHROPIC_API_KEY ? { provider: "anthropic" as const, model: env.REVENANT_MODEL || DEFAULT_CLAUDE_MODEL } : null;
  if (choice === "gemini") return gemini;
  if (choice === "anthropic") return claude;
  return gemini ?? claude;
}

export function llmAvailable(): boolean {
  return claimProvider() !== null;
}

/** LLM when configured, otherwise the lexical check. */
export async function checkClaim(input: ClaimInput): Promise<ClaimCheck> {
  if (!input.archiveText && !input.liveText) {
    return { archive: "unknown", method: "lexical", rationale: "There was no page text to compare." };
  }
  const p = claimProvider();
  if (!p) return lexicalCheck(input);
  return p.provider === "gemini" ? geminiClaimCheck(input, process.env.GEMINI_API_KEY!, p.model) : anthropicClaimCheck(input, p.model);
}
