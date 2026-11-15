/** Redis is picked up from Upstash or Vercel KV variables; blanks do not count. */
import { describe, expect, it } from "vitest";
import { redisConfig } from "../../src/core/net/cache";

describe("redisConfig", () => {
  it("uses the Upstash variables", () => {
    expect(redisConfig({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" })).toEqual({ url: "https://a.upstash.io", token: "t" });
  });
  it("uses the Vercel KV variables that the Upstash integration injects", () => {
    expect(redisConfig({ KV_REST_API_URL: "https://b.upstash.io", KV_REST_API_TOKEN: "k" })).toEqual({ url: "https://b.upstash.io", token: "k" });
  });
  it("treats blank Upstash lines as unset and falls back to KV", () => {
    expect(redisConfig({ UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: " ", KV_REST_API_URL: "https://b.upstash.io", KV_REST_API_TOKEN: "k" })).toEqual({ url: "https://b.upstash.io", token: "k" });
  });
  it("needs both a url and a token", () => {
    expect(redisConfig({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io" })).toBeNull();
    expect(redisConfig({})).toBeNull();
  });
});
