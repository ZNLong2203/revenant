/**
 * POST /api/census/targets  { input: string, lang?: string, limit?: number }
 * Turns a category, a domain (`domain:example.com`) or a list of titles (one
 * per line) into the article titles a census will visit. Nothing is examined.
 */
import { z } from "zod";
import { parseCensusSource, resolveTargets } from "@/core/census/targets";
import { DEFAULT_LIMIT, HOSTED_MAX_ARTICLES } from "@/core/census/types";
import { SourceError } from "@/core/sources";
import { rateLimit, tooMany } from "@/server/ratelimit";
import { sourceErrorResponse } from "@/server/source-error";

export const maxDuration = 30;

const Body = z.object({
  input: z.string().min(1).max(300_000),
  lang: z.string().max(16).optional(),
  limit: z.number().int().min(1).optional(),
});

export async function POST(req: Request) {
  const limit = rateLimit(req, "census-targets", 30);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { input } with a category, domain:example.com, or article titles one per line." }, { status: 400 });

  const wanted = parsed.data.limit ?? DEFAULT_LIMIT;
  if (wanted > HOSTED_MAX_ARTICLES) {
    return Response.json({ error: `The hosted app counts at most ${HOSTED_MAX_ARTICLES} articles. Run \`npx tsx bin/revenant.ts census\` on your own machine for a larger census.` }, { status: 422 });
  }
  try {
    const target = parseCensusSource(parsed.data.input, parsed.data.lang ?? "en");
    const { articles, more } = await resolveTargets(target, wanted);
    if (articles.length > HOSTED_MAX_ARTICLES) {
      throw new SourceError(`That list has ${articles.length} articles. The hosted app counts at most ${HOSTED_MAX_ARTICLES}; run \`npx tsx bin/revenant.ts census\` on your own machine instead.`);
    }
    return Response.json({ source: target.source, articles, more });
  } catch (error) {
    return sourceErrorResponse(error);
  }
}
