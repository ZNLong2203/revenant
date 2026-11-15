/**
 * POST /api/census/article  { lang: string, title: string }
 * Loads one Wikipedia article with every extracted link, for the census page.
 * Same payload as /api/exhume, with its own, higher hourly limit because a
 * census visits many articles.
 */
import { z } from "zod";
import { isLang } from "@/core/census/targets";
import { loadDocument } from "@/core/sources";
import { rateLimit, tooMany } from "@/server/ratelimit";
import { sourceErrorResponse } from "@/server/source-error";

export const maxDuration = 30;

const Body = z.object({
  lang: z.string().refine(isLang),
  title: z.string().min(1).max(300),
});

export async function POST(req: Request) {
  const limit = rateLimit(req, "census-article", Number(process.env.REVENANT_CENSUS_ARTICLES_PER_HOUR ?? 400));
  if (!limit.ok) return tooMany(limit.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { lang, title }." }, { status: 400 });
  try {
    return Response.json(await loadDocument({ kind: "wikipedia", lang: parsed.data.lang, title: parsed.data.title }));
  } catch (error) {
    return sourceErrorResponse(error);
  }
}
