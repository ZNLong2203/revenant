/**
 * Revenant as a remote MCP server (Streamable HTTP, stateless).
 * The Kiro Power in powers/revenant points here, so any Kiro user can add
 * link-rot checks to their agent without installing anything.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRevenantServer } from "@/mcp/tools";
import { rateLimit, tooMany } from "@/server/ratelimit";

export const maxDuration = 300;

async function handle(req: Request): Promise<Response> {
  const limit = rateLimit(req, "mcp", Number(process.env.REVENANT_MCP_PER_HOUR ?? 300));
  if (!limit.ok) return tooMany(limit.retryAfter);
  // stateless: a fresh server + transport per request
  const server = createRevenantServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
