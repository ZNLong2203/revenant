/**
 * Claim verification with Google Gemini (structured JSON output, low thinking).
 * Server-only.
 */
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { ClaimCheck } from "../types";
import { lexicalCheck } from "./lexical";
import { SYSTEM_PROMPT, toClaimCheck, userMessage, Verification, VERIFICATION_JSON_SCHEMA, type ClaimInput } from "./prompt";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

let client: { key: string; ai: GoogleGenAI } | undefined;
function getClient(apiKey: string): GoogleGenAI {
  if (client?.key !== apiKey) {
    client = { key: apiKey, ai: new GoogleGenAI({ apiKey, httpOptions: { timeout: 45_000, retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 6 } } }) };
  }
  return client.ai;
}

export async function geminiClaimCheck(input: ClaimInput, apiKey: string, model = DEFAULT_GEMINI_MODEL): Promise<ClaimCheck> {
  try {
    const response = await getClient(apiKey).models.generateContent({
      model,
      contents: userMessage(input),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: VERIFICATION_JSON_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 2048,
      },
    });
    const parsed = Verification.safeParse(JSON.parse(response.text ?? "{}"));
    if (!parsed.success) {
      return { ...lexicalCheck(input), rationale: "The model's answer did not match the expected shape, so Revenant fell back to word overlap." };
    }
    return toClaimCheck(parsed.data, input, response.modelVersion ?? model);
  } catch (error) {
    const reason =
      error instanceof ApiError
        ? error.status === 429
          ? "the model was rate limited"
          : error.status === 401 || error.status === 403
            ? "the API key was rejected"
            : `the model API failed (${error.status})`
        : error instanceof SyntaxError
          ? "the model returned invalid JSON"
          : "the model call failed";
    return { ...lexicalCheck(input), rationale: `Word-overlap check used because ${reason}.` };
  }
}
