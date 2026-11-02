/**
 * Revenant's MCP tools. One definition, two transports: stdio
 * (bin/revenant-mcp.ts, used by Kiro locally) and Streamable HTTP
 * (/api/mcp, used by the Kiro Power and any remote agent).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectFormat } from "../core/extract";
import { examineLink } from "../core/server";
import { patchScan, scanDocument, type ScanResult } from "../core/scan";
import { loadDocument } from "../core/sources";
import type { DocumentFormat, Examination } from "../core/types";
import { normalizeUrl } from "../core/url";

const VERSION = "0.1.0";
const FORMAT = z.enum(["auto", "wikitext", "markdown", "html", "text"]).default("auto");

function brief(ex: Examination) {
  return {
    url: ex.url,
    verdict: ex.verdict,
    confidence: ex.confidence,
    summary: ex.summary,
    evidence: ex.evidence.slice(0, 4).map((e) => `${e.points} (${e.weight.toFixed(2)}): ${e.detail}`),
    remedy: ex.remedy,
    claim: ex.claim ? { archive: ex.claim.archive, live: ex.claim.live, quote: ex.claim.quote, method: ex.claim.method } : undefined,
  };
}

function report(scan: ScanResult) {
  const problems = scan.doc.links
    .map((l) => ({ link: l, ex: scan.results[l.id] }))
    .filter(({ ex }) => ex && ex.verdict !== "alive")
    .map(({ link, ex }) => ({ ...brief(ex), cited: link.title ?? link.context.slice(0, 120), offset: link.span.start }));
  return {
    document: scan.doc.title,
    format: scan.doc.format,
    linksChecked: scan.doc.links.length,
    linksNotChecked: scan.doc.truncated,
    counts: scan.counts,
    problems,
  };
}

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

export function createRevenantServer(): McpServer {
  const server = new McpServer(
    { name: "revenant", version: VERSION },
    {
      instructions:
        "Revenant checks cited links for link rot that status-code checkers miss: domains taken over by squatters (possessed), soft 404s (ghost), replaced content (changeling) and plain dead links (buried). Use examine_link for one URL, scan_document for Markdown/wikitext/HTML you are editing, and raise_patch to get a corrected document plus a unified diff. Verdicts map to Wikipedia url-status values.",
    },
  );

  server.registerTool(
    "examine_link",
    {
      title: "Examine one link",
      description:
        "Check one URL: is it alive, buried (404/DNS gone), a ghost (soft 404), possessed (domain re-registered, parked or turned into spam) or a changeling (content replaced)? Returns evidence and the archived copy to use instead.",
      inputSchema: {
        url: z.string().describe("Absolute http(s) URL"),
        accessDate: z.string().optional().describe("ISO date the author last saw the page (YYYY-MM-DD). Improves takeover detection."),
        title: z.string().optional().describe("Title of the cited page, if known"),
        context: z.string().optional().describe("The sentence that cites the link"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ url, accessDate, title, context }) => {
      const normal = normalizeUrl(url);
      if (!normal) return { ...json({ error: "Not an absolute http(s) URL" }), isError: true };
      const ex = await examineLink({ linkId: "mcp", url: normal, accessDate, title, context });
      return json(brief(ex));
    },
  );

  server.registerTool(
    "scan_document",
    {
      title: "Scan a document's links",
      description:
        "Extract every external link from Markdown, wikitext, HTML or plain text and examine each one. Returns counts per verdict and the links that need attention.",
      inputSchema: {
        text: z.string().max(2_000_000).describe("The document source"),
        format: FORMAT.describe("Source format; auto-detected if omitted"),
        maxLinks: z.number().int().min(1).max(150).default(60).describe("Examine at most this many links"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ text, format, maxLinks }) => {
      const fmt: DocumentFormat = format === "auto" ? detectFormat(text) : format;
      const doc = await loadDocument({ kind: "paste", text, format: fmt });
      return json(report(await scanDocument(doc, { maxLinks })));
    },
  );

  server.registerTool(
    "scan_source",
    {
      title: "Scan a Wikipedia article, GitHub file or web page",
      description:
        "Fetch a document by reference and scan its links. Accepts a Wikipedia URL or 'wiki:Title', a GitHub repo/file URL (scans the README or that file), or any web page URL.",
      inputSchema: {
        source: z.string().describe("e.g. https://en.wikipedia.org/wiki/PHP, wiki:PHP, https://github.com/owner/repo"),
        maxLinks: z.number().int().min(1).max(150).default(60),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ source, maxLinks }) => {
      const { parseInput } = await import("../core/sources");
      const doc = await loadDocument(parseInput(source));
      return json(report(await scanDocument(doc, { maxLinks })));
    },
  );

  server.registerTool(
    "raise_patch",
    {
      title: "Raise the dead: patch a document",
      description:
        "Scan a document and return it with every possessed, ghost, buried and changeling link fixed: wikitext citations get archive-url, archive-date and url-status; Markdown and HTML links point at the archived copy. Also returns a unified diff. Does not write any file.",
      inputSchema: {
        text: z.string().max(2_000_000),
        format: FORMAT,
        fileName: z.string().optional().describe("Used in the diff header"),
        maxLinks: z.number().int().min(1).max(150).default(60),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ text, format, fileName, maxLinks }) => {
      const fmt: DocumentFormat = format === "auto" ? detectFormat(text) : format;
      const doc = await loadDocument({ kind: "paste", text, format: fmt });
      const scan = await scanDocument(doc, { maxLinks });
      const patch = patchScan(scan, fileName);
      return json({ ...report(scan), applied: patch.applied, skipped: patch.skipped, diff: patch.diff, patched: patch.text });
    },
  );

  return server;
}
