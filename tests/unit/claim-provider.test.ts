/** Provider selection for claim checks (spec: .kiro/specs/resurrection-engine, Requirement 2.2). */
import { describe, expect, it } from "vitest";
import { claimProvider } from "../../src/core/claim/llm";
import { toClaimCheck } from "../../src/core/claim/prompt";

describe("claim provider selection", () => {
  it("prefers Gemini when its key is set", () => {
    expect(claimProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" })).toEqual({ provider: "gemini", model: "gemini-3.8-flash" });
  });

  it("falls back to Claude when only its key is set", () => {
    expect(claimProvider({ ANTHROPIC_API_KEY: "a" })?.provider).toBe("anthropic");
  });

  it("uses no model without keys, or when switched off", () => {
    expect(claimProvider({})).toBeNull();
    expect(claimProvider({ GEMINI_API_KEY: "g", REVENANT_LLM: "off" })).toBeNull();
  });

  it("honours an explicit provider and model override", () => {
    expect(claimProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", REVENANT_LLM: "anthropic" })?.provider).toBe("anthropic");
    expect(claimProvider({ GEMINI_API_KEY: "g", REVENANT_MODEL: "gemini-x" })?.model).toBe("gemini-x");
    expect(claimProvider({ ANTHROPIC_API_KEY: "a", REVENANT_LLM: "gemini" })).toBeNull();
  });
});

describe("model answers", () => {
  const input = { claim: "Azure works with PHP.", url: "http://x.org", archiveText: "The Windows Azure SDK for PHP enables PHP developers to use Azure storage." };

  it("keeps a quote that really appears in the archived text", () => {
    const c = toClaimCheck({ archive: "supported", live: "not_provided", quote: "The Windows Azure SDK for PHP enables PHP developers", rationale: "ok" }, input, "m");
    expect(c.quote).toBeDefined();
    expect(c.live).toBeUndefined();
  });

  it("drops a quote the model invented", () => {
    const c = toClaimCheck({ archive: "supported", live: "not_provided", quote: "Microsoft guarantees PHP support forever and ever", rationale: "ok" }, input, "m");
    expect(c.quote).toBeUndefined();
  });
});
