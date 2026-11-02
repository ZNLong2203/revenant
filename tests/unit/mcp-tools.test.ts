/** Spec: .kiro/specs/agent-surfaces, Requirement 1.1. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createRevenantServer } from "../../src/mcp/tools";

describe("MCP server", () => {
  it("exposes exactly the four read-only, open-world tools", async () => {
    const server = createRevenantServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1.0.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["examine_link", "raise_patch", "scan_document", "scan_source"]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.openWorldHint).toBe(true);
      expect(t.description?.length).toBeGreaterThan(40);
    }
    await client.close();
  });

  it("rejects a non-URL without touching the network", async () => {
    const server = createRevenantServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1.0.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    const res = await client.callTool({ name: "examine_link", arguments: { url: "not a url" } });
    expect(res.isError).toBe(true);
    await client.close();
  });
});
