/**
 * Production wiring for the examine pipeline: real network, shared cache.
 * Import this from server code only (API routes, CLI, MCP server).
 */
import { checkClaim } from "./claim/llm";
import { examine, type ExamineDeps } from "./examine";
import { cached } from "./net/cache";
import { observeLive } from "./net/fetch";
import { findArchive, firstSeen, lookupDomain } from "./net/sources";
import type { Examination, ExamineRequest } from "./types";

export const liveDeps: ExamineDeps = {
  live: (url) => cached(`live:${url}`, 6 * 3600, () => observeLive(url)),
  domain: lookupDomain,
  archive: (url, opts) => cached(`arch:${url}:${opts.target ?? ""}:${opts.notAfter ?? ""}`, 3 * 86_400, () => findArchive(url, opts)),
  firstSeen,
  claim: checkClaim,
};

export async function examineLink(req: ExamineRequest): Promise<Examination> {
  const key = `exam:v1:${req.url}:${req.accessDate ?? ""}:${req.context?.slice(0, 80) ?? ""}`;
  return cached(key, 12 * 3600, () => examine(req, liveDeps));
}
