#!/usr/bin/env -S npx tsx
/**
 * Revenant MCP server over stdio. Kiro starts it from .kiro/settings/mcp.json:
 *   { "command": "npx", "args": ["tsx", "bin/revenant-mcp.ts"] }
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRevenantServer } from "../src/mcp/tools";

const server = createRevenantServer();
await server.connect(new StdioServerTransport());
// stdout carries the protocol; say hello on stderr only
console.error("revenant MCP server ready (stdio)");
