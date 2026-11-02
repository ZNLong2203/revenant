/**
 * POST /api/examine  { linkId, url, title?, context?, accessDate?, quote?, existingArchive? }
 * Examines one link: live page, RDAP, Wayback CDX, claim check. Returns an
 * Examination (see src/core/types.ts).
 */
import { z } from "zod";
import { examineLink } from "@/core/server";
import { normalizeUrl } from "@/core/url";
import { rateLimit, tooMany } from "@/server/ratelimit";

export const maxDuration = 60;

const Body = z.object({
  linkId: z.string().max(64),
  url: z.string().max(4000),
  title: z.string().max(1000).optional(),
  context: z.string().max(2000).optional(),
  accessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  quote: z.string().max(2000).optional(),
  existingArchive: z.object({ url: z.string().max(4000), date: z.string().optional() }).optional(),
});

export async function POST(req: Request) {
  const limit = rateLimit(req, "examine", Number(process.env.REVENANT_EXAMINE_PER_HOUR ?? 1500));
  if (!limit.ok) return tooMany(limit.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid examine request." }, { status: 400 });
  const url = normalizeUrl(parsed.data.url);
  if (!url) return Response.json({ error: "Not an absolute http(s) URL." }, { status: 400 });
  const ex = await examineLink({ ...parsed.data, url });
  return Response.json(ex);
}
