/** GET /api/status: which backends this deployment is using. */
import { connection } from "next/server";
import { llmAvailable, DEFAULT_CLAIM_MODEL } from "@/core/claim/llm";
import { cacheBackend } from "@/core/net/cache";

export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    cache: cacheBackend(),
    claimCheck: llmAvailable() ? "llm" : "lexical",
    model: llmAvailable() ? process.env.REVENANT_MODEL || DEFAULT_CLAIM_MODEL : null,
    mcp: "/api/mcp",
  });
}
