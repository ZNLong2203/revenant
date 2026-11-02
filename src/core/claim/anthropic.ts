/**
 * Claim verification with Claude (optional provider). Server-only.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { ClaimCheck } from "../types";
import { lexicalCheck } from "./lexical";
import { SYSTEM_PROMPT, toClaimCheck, userMessage, Verification, type ClaimInput } from "./prompt";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

export async function anthropicClaimCheck(input: ClaimInput, model = DEFAULT_CLAUDE_MODEL): Promise<ClaimCheck> {
  try {
    const response = await getClient().beta.messages.parse({
      model,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "low", format: betaZodOutputFormat(Verification) },
      messages: [{ role: "user", content: userMessage(input) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ...lexicalCheck(input), rationale: "The model declined to judge this page, so Revenant fell back to word overlap." };
    }
    return toClaimCheck(response.parsed_output, input, response.model);
  } catch (error) {
    const reason =
      error instanceof Anthropic.RateLimitError
        ? "the model was rate limited"
        : error instanceof Anthropic.AuthenticationError
          ? "the API key was rejected"
          : error instanceof Anthropic.APIError
            ? `the model API failed (${error.status ?? "network"})`
            : "the model call failed";
    return { ...lexicalCheck(input), rationale: `Word-overlap check used because ${reason}.` };
  }
}
