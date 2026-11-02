/**
 * Production wiring for the examine pipeline: real network, shared cache.
 * Import this from server code only (API routes, CLI, MCP server).
 */
import { checkClaim } from "./claim/llm";
import { examine, type ExamineDeps } from "./examine";
import { cached, cacheGet, cacheSet } from "./net/cache";
import { observeLive } from "./net/fetch";
import { findArchive, firstSeen, lookupDomain } from "./net/sources";
import type { Examination, ExamineRequest, LiveObservation } from "./types";

/** Live pages: keep answers for 6 h, but retry timeouts and 5xx after 20 min. */
async function liveCached(url: string) {
  const key = `live:${url}`;
  const hit = await cacheGet<LiveObservation>(key);
  if (hit) return hit;
  let obs = await observeLive(url);
  // busy servers time out under a burst of citations to the same host; give them one slower retry
  if (obs.errorKind === "timeout") obs = await observeLive(url, { timeoutMs: 25_000 });
  const transient = obs.errorKind === "timeout" || obs.errorKind === "other" || (obs.status ?? 0) >= 500 || obs.status === 429;
  await cacheSet(key, obs, transient ? 1200 : 6 * 3600);
  return obs;
}

export const liveDeps: ExamineDeps = {
  live: liveCached,
  domain: lookupDomain,
  archive: (url, opts) => cached(`arch:${url}:${opts.target ?? ""}:${opts.notAfter ?? ""}`, 3 * 86_400, () => findArchive(url, opts)),
  firstSeen,
  claim: checkClaim,
};

export async function examineLink(req: ExamineRequest): Promise<Examination> {
  const key = `exam:v2:${req.url}:${req.accessDate ?? ""}:${req.context?.slice(0, 80) ?? ""}`;
  const hit = await cacheGet<Examination>(key);
  if (hit) return { ...hit, linkId: req.linkId };
  const ex = await examine(req, liveDeps);
  // an "unknown" is usually a timeout or a bot wall; let it be retried soon
  await cacheSet(key, ex, ex.verdict === "unknown" ? 600 : 12 * 3600);
  return ex;
}
