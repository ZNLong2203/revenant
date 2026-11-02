/** Spec: .kiro/specs/agent-surfaces, Requirement 3.3. */
import { describe, expect, it } from "vitest";
import { pathsFromPayload } from "../../src/cli/payload";

describe("hook payload parsing", () => {
  it("finds document paths in nested objects and arrays", () => {
    const payload = {
      hook_event_name: "PostFileSave",
      cwd: "/repo",
      tool_input: { file_path: "docs/guide.md", content: "see https://example.com/readme.md" },
      files: [{ path: "README.md" }, { path: "src/app.ts" }],
      changed_paths: ["notes/a.mdx", "image.png"],
    };
    expect(pathsFromPayload(payload).sort()).toEqual(["README.md", "docs/guide.md", "notes/a.mdx"]);
  });

  it("ignores strings that are not under a path or file key", () => {
    expect(pathsFromPayload({ prompt: "fix README.md please", url: "https://x.org/a.html" })).toEqual([]);
  });

  it("copes with empty and non-object payloads", () => {
    expect(pathsFromPayload({})).toEqual([]);
    expect(pathsFromPayload(null)).toEqual([]);
    expect(pathsFromPayload("README.md")).toEqual([]);
  });
});
