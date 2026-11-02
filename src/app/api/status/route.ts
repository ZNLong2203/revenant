/** GET /api/status: which backends this deployment is using. */
import { connection } from "next/server";
import { claimProvider } from "@/core/claim/llm";
import { cacheBackend } from "@/core/net/cache";
import { cdxPaused } from "@/core/net/sources";

export async function GET() {
  await connection();
  const llm = claimProvider();
  return Response.json({
    ok: true,
    cache: cacheBackend(),
    claimCheck: llm ? "llm" : "lexical",
    provider: llm?.provider ?? null,
    model: llm?.model ?? null,
    archive: cdxPaused() ? "paused" : "ok",
    mcp: "/api/mcp",
  });
}
