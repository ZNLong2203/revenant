#!/usr/bin/env -S npx tsx
/**
 * Revenant CLI.
 *
 *   revenant scan <file | url | wiki:Title>...  [--fail-on possessed,ghost] [--max 60] [--json] [--fix] [--diff]
 *   revenant check <url> [--access-date YYYY-MM-DD] [--json]
 *   revenant hook                       read a Kiro/agent hook payload on stdin, scan the files it names
 *
 * Exit codes: 0 clean, 1 a --fail-on verdict was found, 2 usage or input error.
 */
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { detectFormat } from "../src/core/extract";
import { loadDiskCache, saveDiskCache } from "../src/core/net/cache";
import { patchScan, scanDocument, type ScanResult } from "../src/core/scan";
import { examineLink } from "../src/core/server";
import { loadDocument, parseInput } from "../src/core/sources";
import type { DocumentFormat, Examination, Verdict } from "../src/core/types";
import { normalizeUrl } from "../src/core/url";
import { pathsFromPayload } from "../src/cli/payload";

const CACHE = resolve(process.env.REVENANT_CACHE ?? ".revenant/cache.json");

const ICON: Record<Verdict, string> = {
  possessed: "☠ possessed ",
  changeling: "◐ changeling",
  ghost: "◌ ghost     ",
  buried: "✝ buried    ",
  unknown: "? unknown   ",
  alive: "✓ alive     ",
};
const tty = process.stdout.isTTY;
const COLOR: Record<Verdict, string> = { possessed: "31", changeling: "35", ghost: "36", buried: "90", unknown: "33", alive: "32" };
const paint = (v: Verdict, s: string) => (tty ? `\x1b[${COLOR[v]}m${s}\x1b[0m` : s);

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const has = (args: string[], name: string) => args.includes(`--${name}`);

function formatFor(path: string, text: string): DocumentFormat {
  const ext = extname(path).toLowerCase();
  if ([".md", ".markdown", ".mdx"].includes(ext)) return "markdown";
  if ([".wiki", ".wikitext", ".mediawiki"].includes(ext)) return "wikitext";
  if ([".html", ".htm"].includes(ext)) return "html";
  return detectFormat(text);
}

async function loadTarget(target: string) {
  if (/^(https?:\/\/|wiki:|wp:)/i.test(target)) return { doc: await loadDocument(parseInput(target)), path: undefined };
  const path = resolve(target);
  const text = await readFile(path, "utf8");
  const doc = await loadDocument({ kind: "paste", text, format: formatFor(path, text) });
  return { doc: { ...doc, title: target }, path };
}

function printScan(scan: ScanResult, verbose: boolean) {
  const { doc, results, counts } = scan;
  console.log(`\n${doc.title}  (${doc.format}, ${doc.links.length} links${doc.truncated ? `, ${doc.truncated} not checked` : ""})`);
  for (const link of doc.links) {
    const ex = results[link.id];
    if (!ex || (ex.verdict === "alive" && !verbose)) continue;
    console.log(`  ${paint(ex.verdict, ICON[ex.verdict])}  ${link.url}`);
    console.log(`               ${ex.summary.replace(/^\w+: /, "")}`);
    if (ex.remedy.archiveUrl) console.log(`               → ${ex.remedy.archiveUrl}`);
  }
  const tally = (Object.keys(counts) as Verdict[]).filter((v) => counts[v]).map((v) => `${counts[v]} ${v}`);
  console.log(`  ${tally.join(" · ") || "no links"}`);
}

async function cmdScan(args: string[]): Promise<number> {
  const valueFlags = new Set(["--fail-on", "--max"]);
  const targets = args.filter((a, i) => !a.startsWith("--") && !valueFlags.has(args[i - 1] ?? ""));
  if (!targets.length) return usage();
  const failOn = (flag(args, "fail-on") ?? "possessed").split(",").map((s) => s.trim()) as Verdict[];
  const max = Number(flag(args, "max") ?? 60);
  let failed = false;
  const out: unknown[] = [];
  for (const t of targets) {
    const { doc, path } = await loadTarget(t);
    const scan = await scanDocument(doc, { maxLinks: max });
    if (Object.entries(scan.counts).some(([v, n]) => n > 0 && failOn.includes(v as Verdict))) failed = true;
    const patch = has(args, "fix") || has(args, "diff") ? patchScan(scan, t) : undefined;
    if (patch && has(args, "fix") && path && patch.applied.length) await writeFile(path, patch.text);
    if (has(args, "json")) {
      out.push({ target: t, counts: scan.counts, results: Object.values(scan.results).filter((r) => r.verdict !== "alive"), patch: patch && { applied: patch.applied, diff: patch.diff } });
    } else {
      printScan(scan, has(args, "verbose"));
      if (patch && has(args, "diff") && patch.applied.length) console.log(`\n${patch.diff}`);
      if (patch && has(args, "fix")) console.log(path ? `  fixed ${patch.applied.length} link(s) in ${t}` : "  --fix only rewrites local files");
    }
  }
  if (has(args, "json")) console.log(JSON.stringify(out, null, 2));
  return failed ? 1 : 0;
}

async function cmdCheck(args: string[]): Promise<number> {
  const url = normalizeUrl(args.find((a) => /^https?:/i.test(a)) ?? "");
  if (!url) return usage();
  const ex: Examination = await examineLink({ linkId: "cli", url, accessDate: flag(args, "access-date") });
  if (has(args, "json")) console.log(JSON.stringify(ex, null, 2));
  else {
    console.log(`${paint(ex.verdict, ICON[ex.verdict])}  ${url}  (confidence ${ex.confidence})`);
    for (const e of ex.evidence.slice(0, 5)) console.log(`   ${e.points.padEnd(10)} ${e.weight.toFixed(2)}  ${e.detail}`);
    if (ex.remedy.archiveUrl) console.log(`   → ${ex.remedy.archiveUrl}`);
  }
  return ex.verdict === "possessed" ? 1 : 0;
}

async function cmdHook(): Promise<number> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  let payload: unknown = {};
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    // not JSON: nothing to do
  }
  const paths = pathsFromPayload(payload);
  if (!paths.length) return 0;
  let problems = 0;
  for (const p of paths) {
    const { doc } = await loadTarget(p).catch(() => ({ doc: undefined }));
    if (!doc?.links.length) continue;
    const scan = await scanDocument(doc, { maxLinks: 40 });
    const bad = doc.links.filter((l) => ["possessed", "ghost", "buried", "changeling"].includes(scan.results[l.id]?.verdict));
    problems += bad.length;
    for (const l of bad) {
      const ex = scan.results[l.id];
      console.log(`Revenant: ${p}: ${ex.verdict} link ${l.url}: ${ex.summary}${ex.remedy.archiveUrl ? ` Archived copy: ${ex.remedy.archiveUrl}` : ""}`);
    }
  }
  if (!problems) console.log(`Revenant: ${paths.length} file(s) checked, no possessed, ghost, buried or changeling links.`);
  return 0; // never block the agent; the report is the feedback
}

function usage(): number {
  console.error("usage: revenant scan <file|url|wiki:Title>... [--fail-on possessed,ghost] [--max 60] [--json] [--fix] [--diff] [--verbose]\n       revenant check <url> [--access-date YYYY-MM-DD] [--json]\n       revenant hook < payload.json");
  return 2;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  await loadDiskCache(CACHE);
  let code = 2;
  try {
    if (cmd === "scan") code = await cmdScan(rest);
    else if (cmd === "check") code = await cmdCheck(rest);
    else if (cmd === "hook") code = await cmdHook();
    else code = usage();
  } catch (e) {
    console.error(`revenant: ${(e as Error).message}`);
    code = 2;
  }
  await saveDiskCache(CACHE).catch(() => {});
  process.exit(code);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("revenant.ts")) void main();
