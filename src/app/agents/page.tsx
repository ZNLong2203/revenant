import type { Metadata } from "next";
import { REPO_URL } from "@/components/site";

export const metadata: Metadata = { title: "For agents" };

function Code({ children, label }: { children: string; label: string }) {
  return (
    <figure className="mt-3">
      <figcaption className="mb-1 font-mono text-xs text-ash">{label}</figcaption>
      <pre className="overflow-x-auto rounded-xl border border-seam bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-bone-dim">{children}</pre>
    </figure>
  );
}

const MCP_URL = `${process.env.APP_URL ?? "https://revenant-links.vercel.app"}/api/mcp`;

export default function AgentsPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-candle">For agents</p>
      <h1 className="mt-3 font-display text-5xl text-bone">Catch it where links are written</h1>
      <p className="mt-4 text-lg leading-relaxed text-bone-dim">
        Agents write docs, READMEs and reference lists all day, and they happily paste a link to a domain that was sold to a casino last year. Revenant gives them a
        way to check first.
      </p>

      <section className="mt-12">
        <h2 className="font-display text-3xl text-bone">MCP server</h2>
        <p className="mt-2 text-bone-dim">
          Four read-only tools: <span className="font-mono text-bone">examine_link</span>, <span className="font-mono text-bone">scan_document</span>,{" "}
          <span className="font-mono text-bone">scan_source</span> and <span className="font-mono text-bone">raise_patch</span> (returns the fixed document and a
          diff; writes nothing).
        </p>
        <Code label="Remote (Streamable HTTP): .kiro/settings/mcp.json or any MCP client">{`{
  "mcpServers": {
    "revenant": { "url": "${MCP_URL}" }
  }
}`}</Code>
        <Code label="Local (stdio), from a clone of the repo">{`{
  "mcpServers": {
    "revenant": { "command": "npx", "args": ["tsx", "bin/revenant-mcp.ts"] }
  }
}`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl text-bone">Kiro Power</h2>
        <p className="mt-2 text-bone-dim">
          In Kiro, open the Powers panel, choose <span className="text-bone">Add Custom Power → Import power from GitHub</span> and point it at{" "}
          <span className="font-mono text-bone">{REPO_URL}/tree/main/powers/revenant</span>. It wires up the remote MCP server and two skills (link hygiene and
          Wikipedia citations) that activate when a conversation mentions dead links, citations or link rot.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl text-bone">Agent hook</h2>
        <p className="mt-2 text-bone-dim">
          When the agent saves Markdown, Revenant reads the hook payload on stdin, scans the saved files and reports every possessed, ghost, buried or changeling
          link with an archived copy. It never blocks the agent.
        </p>
        <Code label=".kiro/hooks/docs-link-check.json">{`{
  "version": "v1",
  "hooks": [{
    "name": "Revenant checks the links it just wrote",
    "trigger": "PostFileSave",
    "matcher": "\\\\.(md|mdx)$",
    "action": { "type": "command", "command": "npx tsx bin/revenant.ts hook" },
    "timeout": 120
  }]
}`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl text-bone">CLI</h2>
        <Code label="scan files, URLs or wiki:Title; exit 1 when a --fail-on verdict is found">{`npx tsx bin/revenant.ts scan README.md docs/*.md --fail-on possessed,ghost
npx tsx bin/revenant.ts scan wiki:PHP --diff
npx tsx bin/revenant.ts scan docs/guide.md --fix          # rewrites the local file
npx tsx bin/revenant.ts check https://example.com/page --access-date 2014-03-06`}</Code>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl text-bone">GitHub Action</h2>
        <p className="mt-2 text-bone-dim">
          <span className="font-mono text-bone">.github/workflows/revenant.yml</span> scans the Markdown a pull request changes and fails the check when it adds a
          possessed link.
        </p>
      </section>
    </article>
  );
}
