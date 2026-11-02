/**
 * POST /api/exhume  { input: string, format?: "wikitext" | "markdown" | "html" | "text" }
 * Loads a document (Wikipedia article, GitHub file, web page or pasted text)
 * and returns it with every extracted link. Examination happens per link in
 * /api/examine so results stream into the UI.
 */
import { z } from "zod";
import { loadDocument, parseInput, SourceError } from "@/core/sources";
import { FetchFailure } from "@/core/net/fetch";
import { rateLimit, tooMany } from "@/server/ratelimit";

export const maxDuration = 30;

const Body = z.object({
  input: z.string().min(1).max(1_500_000),
  format: z.enum(["wikitext", "markdown", "html", "text"]).optional(),
});

export async function POST(req: Request) {
  const limit = rateLimit(req, "exhume", 60);
  if (!limit.ok) return tooMany(limit.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { input } with a URL, wiki:Title, or the text to scan." }, { status: 400 });
  try {
    const input = parseInput(parsed.data.input);
    const doc = await loadDocument(input.kind === "paste" && parsed.data.format ? { ...input, format: parsed.data.format } : input);
    return Response.json(doc);
  } catch (error) {
    const message =
      error instanceof SourceError
        ? error.message
        : error instanceof FetchFailure
          ? `Could not fetch that source (${error.kind === "blocked" ? "it points at a private network" : error.message}).`
          : "Something went wrong while loading that source.";
    return Response.json({ error: message }, { status: error instanceof SourceError || error instanceof FetchFailure ? 422 : 500 });
  }
}
