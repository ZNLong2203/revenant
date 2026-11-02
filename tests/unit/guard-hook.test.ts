/** The PreToolUse guard behind .kiro/hooks/guard-bot-etiquette.json. */
import { describe, expect, it } from "vitest";
import { check } from "../../scripts/hooks/guard-bot-etiquette.mjs";

describe("bot-etiquette guard", () => {
  it("blocks spoofed browser user agents", () => {
    expect(check('curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130" https://example.com')?.id).toBe("browser-ua");
    expect(check("curl --user-agent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' https://x.org")?.id).toBe("browser-ua");
  });

  it("allows Revenant's own honest user agent", () => {
    expect(check('curl -A "Mozilla/5.0 (compatible; RevenantBot/0.1; +https://github.com/ZNLong2203/revenant)" https://x.org')).toBeUndefined();
  });

  it("blocks anti-bot bypass tooling", () => {
    expect(check("pip install cloudscraper && python scrape.py")?.id).toBe("bypass-tooling");
    expect(check("npm i puppeteer-extra-plugin-stealth")?.id).toBe("bypass-tooling");
  });

  it("blocks staging private files but not normal adds", () => {
    expect(check("git add private/devpost-form.md")?.id).toBe("stage-private");
    expect(check("git add -f private")?.id).toBe("stage-private");
    expect(check("git add .env.local")?.id).toBe("stage-private");
    expect(check("git add .env.example docs/KIRO.md")).toBeUndefined();
    expect(check("git add src/core/net/fetch.ts")).toBeUndefined();
  });
});
