#!/usr/bin/env node
/**
 * PreToolUse guard for shell commands (see .kiro/hooks/guard-bot-etiquette.json
 * and .kiro/steering/web-politeness.md).
 *
 * Reads the hook event JSON on stdin. Exits 2 with a reason on stderr to block:
 *   - spoofing a desktop browser user agent, or anti-bot bypass tooling
 *   - staging private/ or .env files in git
 * Exits 0 otherwise. Never blocks on malformed input.
 */
import { stdin } from "node:process";

export const RULES = [
  {
    id: "browser-ua",
    test: /(?:-A|--user-agent|user-agent:)\s*["']?Mozilla\/5\.0 \((?:Macintosh|Windows NT|X11|iPhone|Linux; Android)/i,
    reason:
      "Revenant identifies itself as RevenantBot. Do not send a desktop or mobile browser user agent to third-party sites; a site that refuses bots gets an 'unknown' verdict for a person to check.",
  },
  {
    id: "bypass-tooling",
    test: /\b(cloudscraper|undetected[-_]chromedriver|puppeteer-extra-plugin-stealth|playwright-stealth|flaresolverr|curl[-_]impersonate|curl_cffi)\b/i,
    reason: "Anti-bot bypass tools are off limits (web-politeness.md). Report the site as unknown instead.",
  },
  {
    id: "stage-private",
    test: /\bgit\s+add\b[^\n;&|]*(?:\s-f\b|--force\b)?[^\n;&|]*(?:^|\s)(?:\.\/)?(?:private(?:\/|\s|$)|\.env(?!\.example)\b)/i,
    reason: "private/ and .env files must never be committed: the repository is public.",
  },
];

export function check(command) {
  for (const r of RULES) if (r.test.test(command)) return r;
  return undefined;
}

function commandOf(event) {
  const input = event?.tool_input ?? event?.toolInput ?? {};
  return [input.command, input.cmd, input.script, Array.isArray(input.args) ? input.args.join(" ") : undefined]
    .filter((x) => typeof x === "string")
    .join("\n");
}

async function main() {
  let raw = "";
  for await (const chunk of stdin) raw += chunk;
  let event;
  try {
    event = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }
  const hit = check(commandOf(event));
  if (hit) {
    process.stderr.write(`Blocked by Revenant guard (${hit.id}): ${hit.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
